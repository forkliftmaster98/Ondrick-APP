import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const createSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().url().optional(),
  sortOrder: z.number().int().optional(),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminTeamMembersRoutes(app: FastifyInstance) {
  app.post('/admin/team-members', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const existing = await prisma.teamMember.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      return reply.status(409).send({ error: 'key_taken' });
    }
    const member = await prisma.teamMember.create({ data: { ...parsed.data, sortOrder: parsed.data.sortOrder ?? 0 } });
    return reply.status(201).send({ member });
  });

  app.patch('/admin/team-members/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const member = await prisma.teamMember.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ member });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/team-members/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.teamMember.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
