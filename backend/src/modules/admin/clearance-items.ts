import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const createSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional(),
  priceLabel: z.string().trim().min(1).max(100),
  wasPriceLabel: z.string().trim().max(100).optional(),
  qtyLabel: z.string().trim().max(100).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminClearanceItemsRoutes(app: FastifyInstance) {
  // Includes inactive rows (unlike the public GET /clearance-items) so
  // admins can find the id of anything, not just what they created.
  app.get('/admin/clearance-items', { preHandler: requireAdmin }, async (_request, reply) => {
    const items = await prisma.clearanceItem.findMany({ orderBy: { sortOrder: 'asc' } });
    return reply.send({ items });
  });

  app.post('/admin/clearance-items', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const existing = await prisma.clearanceItem.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      return reply.status(409).send({ error: 'key_taken' });
    }
    const item = await prisma.clearanceItem.create({
      data: { ...parsed.data, active: parsed.data.active ?? true, sortOrder: parsed.data.sortOrder ?? 0 },
    });
    return reply.status(201).send({ item });
  });

  app.patch('/admin/clearance-items/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const item = await prisma.clearanceItem.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ item });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/clearance-items/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.clearanceItem.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
