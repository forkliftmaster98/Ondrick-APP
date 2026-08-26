import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const createSchema = z.object({
  code: z.string().trim().min(1).max(64),
  label: z.string().trim().max(200).optional(),
});
const updateSchema = z.object({
  label: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
});
const paramsSchema = z.object({ id: z.string().uuid() });

// Numbered, individually-revocable codes (see BACKEND_SPEC.md's contractor
// verification design) — mint one per contractor/company so a leaked code
// traces back to whoever it was issued to, and can be deactivated alone
// without rotating everyone else's.
export async function adminContractorCodesRoutes(app: FastifyInstance) {
  app.get('/admin/contractor-codes', { preHandler: requireAdmin }, async (_request, reply) => {
    const codes = await prisma.contractorCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } }, users: { select: { email: true }, take: 5 } },
    });
    return reply.send({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        active: c.active,
        createdAt: c.createdAt,
        verifiedCount: c._count.users,
        verifiedSample: c.users.map((u) => u.email),
      })),
    });
  });

  app.post('/admin/contractor-codes', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const normalizedCode = parsed.data.code.toUpperCase();
    const existing = await prisma.contractorCode.findUnique({ where: { code: normalizedCode } });
    if (existing) {
      return reply.status(409).send({ error: 'code_taken' });
    }
    const code = await prisma.contractorCode.create({
      data: { code: normalizedCode, label: parsed.data.label, active: true },
    });
    return reply.status(201).send({ code });
  });

  // Deactivate/relabel — never delete: a used code stays attached to the
  // contractors who verified with it (contractorCodeId), so deleting the
  // row would orphan that history.
  app.patch('/admin/contractor-codes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const code = await prisma.contractorCode.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ code });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
