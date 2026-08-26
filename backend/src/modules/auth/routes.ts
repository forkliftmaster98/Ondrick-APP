import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { sendEmail } from '../../lib/email.js';
import { sha256Hex } from '../../lib/hash.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { toSafeUser } from '../../lib/safe-user.js';
import { createSession, deleteAllUserSessions, deleteSession } from '../../lib/session.js';
import { requireAuth, SESSION_COOKIE } from '../../middleware/auth.js';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

const patchMeSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(50),
    address: z.string().trim().max(500),
    driverNotes: z.string().trim().max(1000),
    notifOrderUpdates: z.boolean(),
    notifPromos: z.boolean(),
    prefLargeText: z.boolean(),
    prefReduceMotion: z.boolean(),
  })
  .partial();

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { email, password, name, phone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'email_taken' });
    }

    const [passwordHash, adminEmail] = await Promise.all([
      hashPassword(password),
      prisma.adminEmail.findUnique({ where: { email } }),
    ]);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, phone, isAdmin: Boolean(adminEmail) },
    });

    const { token, expiresAt } = await createSession(user.id, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    setSessionCookie(reply, token, expiresAt);

    return reply.status(201).send({ user: toSafeUser(user) });
  });

  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: (request: { ip: string; body: unknown }) => {
            const body = request.body as { email?: string } | undefined;
            return `${request.ip}:${body?.email?.toLowerCase().trim() ?? ''}`;
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      const { token, expiresAt } = await createSession(user.id, {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      });
      setSessionCookie(reply, token, expiresAt);

      return reply.send({ user: toSafeUser(user) });
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await deleteSession(token);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.post('/auth/forgot', async (request, reply) => {
    const parsed = forgotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always 200 whether or not the account exists — the response must not
    // let a caller enumerate registered emails.
    if (user) {
      const token = randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      await sendEmail(app.log, {
        to: user.email,
        subject: 'Reset your Ondrick password',
        text: `Use this code to reset your password (expires in 30 minutes): ${token}`,
      });
    }

    return reply.send({ status: 'ok' });
  });

  app.post('/auth/reset', async (request, reply) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { token, password } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256Hex(token) },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'invalid_or_expired_token' });
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);
    // A reset invalidates every existing session, not just the one that requested it.
    await deleteAllUserSessions(resetToken.userId);

    return reply.send({ status: 'ok' });
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ user: request.currentUser });
  });

  app.patch('/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = patchMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const user = await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: parsed.data,
    });

    return reply.send({ user: toSafeUser(user) });
  });
}
