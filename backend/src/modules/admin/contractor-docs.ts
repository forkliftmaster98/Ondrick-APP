import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

// fileKey is a storage object key/path, not a public URL — real upload +
// signed-URL delivery lands in the Phase 6 asset pipeline. For now an admin
// sets it directly (e.g. after uploading a file some other way).
const createSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  updatedLabel: z.string().trim().max(100).optional(),
  fileKey: z.string().trim().min(1).max(500),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminContractorDocsRoutes(app: FastifyInstance) {
  app.post('/admin/contractor-docs', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const existing = await prisma.contractorDoc.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      return reply.status(409).send({ error: 'key_taken' });
    }
    const doc = await prisma.contractorDoc.create({ data: parsed.data });
    return reply.status(201).send({ doc });
  });

  app.patch('/admin/contractor-docs/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const doc = await prisma.contractorDoc.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ doc });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/contractor-docs/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.contractorDoc.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
