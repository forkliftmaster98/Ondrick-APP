import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { requireAdmin } from '../../middleware/auth.js';

const verifySchema = z.object({ pin: z.string().min(1).max(32) });

// The PIN is only ever a convenience re-entry check on an ALREADY
// server-verified admin session (requireAdmin runs first) — e.g. re-confirm
// before a destructive action on a shared yard tablet. It is never a way to
// become admin; per BACKEND_SPEC.md, "the API must never trust it alone."
export async function adminPinRoutes(app: FastifyInstance) {
  app.post('/admin/verify-pin', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    if (!settings.adminPinHash) {
      return reply.status(400).send({ error: 'pin_not_set' });
    }

    const valid = await verifyPassword(settings.adminPinHash, parsed.data.pin);
    if (!valid) {
      return reply.status(401).send({ error: 'invalid_pin' });
    }

    return reply.send({ status: 'ok' });
  });
}
