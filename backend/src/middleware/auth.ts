import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSessionUser } from '../lib/session.js';
import { toSafeUser, type SafeUser } from '../lib/safe-user.js';

export const SESSION_COOKIE = 'ondrick_session';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SafeUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    return reply.status(401).send({ error: 'unauthenticated' });
  }

  const user = await getSessionUser(token);
  if (!user) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(401).send({ error: 'unauthenticated' });
  }

  request.currentUser = toSafeUser(user);
}
