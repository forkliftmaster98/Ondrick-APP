import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { toSafeUser } from '../../lib/safe-user.js';
import { requireAuth } from '../../middleware/auth.js';

const verifySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export async function contractorRoutes(app: FastifyInstance) {
  app.post('/me/verify-contractor', { preHandler: requireAuth }, async (request, reply) => {
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
  });
}
