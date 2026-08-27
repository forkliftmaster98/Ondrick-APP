import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsOn: z.coerce.date(),
  timeLabel: z.string().trim().max(100).optional(),
  note: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminEventsRoutes(app: FastifyInstance) {
  // Includes inactive/past events (unlike the public GET /events), so
  // admins can find the id of anything to edit or delete.
  app.get('/admin/events', { preHandler: requireAdmin }, async (_request, reply) => {
    const events = await prisma.event.findMany({ orderBy: { startsOn: 'asc' } });
    return reply.send({ events });
  });

  app.post('/admin/events', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const event = await prisma.event.create({ data: { ...parsed.data, active: parsed.data.active ?? true } });
    return reply.status(201).send({ event });
  });

  app.patch('/admin/events/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const event = await prisma.event.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ event });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/events/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.event.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
