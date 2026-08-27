import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { toSafeUser } from '../../lib/safe-user.js';
import { requireAuth, SESSION_COOKIE } from '../../middleware/auth.js';

const verifySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export async function contractorRoutes(app: FastifyInstance) {
  app.post(
    '/me/verify-contractor',
    {
      preHandler: requireAuth,
      config: {
        // Numbered codes are a fairly small keyspace (see BACKEND_SPEC.md's
        // contractor verification design) — without this, a signed-in
        // account could script through candidates looking for an active
        // one. Keyed by session cookie (present before any DB lookup),
        // not by user id, to sidestep any ordering question between this
        // hook and requireAuth populating request.currentUser.
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
          keyGenerator: (request: FastifyRequest) => {
            const cookies = request.cookies as Record<string, string | undefined>;
            return cookies[SESSION_COOKIE] ?? request.ip;
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = verifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
      }

      // Codes are stored uppercase; normalize the same way so "ondrickpro0"
      // and "OndrickPro0" both match.
      const normalizedCode = parsed.data.code.toUpperCase();
      const contractorCode = await prisma.contractorCode.findUnique({ where: { code: normalizedCode } });
      if (!contractorCode || !contractorCode.active) {
        return reply.status(400).send({ error: 'invalid_code' });
      }

      const user = await prisma.user.update({
        where: { id: request.currentUser!.id },
        data: {
          role: 'CONTRACTOR',
          contractorVerifiedAt: new Date(),
          contractorCodeId: contractorCode.id,
        },
      });

      return reply.send({ user: toSafeUser(user) });
    },
  );
}
