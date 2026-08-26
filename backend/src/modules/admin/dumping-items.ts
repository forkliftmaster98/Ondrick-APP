import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const createSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  priceLabel: z.string().trim().min(1).max(100),
  priceNote: z.string().trim().max(200).optional(),
  rules: z.string().trim().min(1).max(5000),
  sortOrder: z.number().int().optional(),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminDumpingItemsRoutes(app: FastifyInstance) {
  app.post('/admin/dumping-items', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const existing = await prisma.dumpingItem.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      return reply.status(409).send({ error: 'key_taken' });
    }
    const item = await prisma.dumpingItem.create({ data: { ...parsed.data, sortOrder: parsed.data.sortOrder ?? 0 } });
    return reply.status(201).send({ item });
  });

  app.patch('/admin/dumping-items/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const item = await prisma.dumpingItem.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ item });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/dumping-items/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.dumpingItem.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
