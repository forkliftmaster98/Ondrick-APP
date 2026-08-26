import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAdmin } from '../../middleware/auth.js';

// The "we cannot accept" list is a short ordered list of strings, not
// individually-addressable rows in the UI — simpler to replace the whole
// list in one call than to build per-item CRUD for it.
const replaceSchema = z.object({
  restrictions: z.array(z.string().trim().min(1).max(300)).max(50),
});

export async function adminDumpingRestrictionsRoutes(app: FastifyInstance) {
  app.get('/admin/dumping-restrictions', { preHandler: requireAdmin }, async (_request, reply) => {
    const restrictions = await prisma.dumpingRestriction.findMany({ orderBy: { sortOrder: 'asc' } });
    return reply.send({ restrictions: restrictions.map((r) => r.text) });
  });

  app.put('/admin/dumping-restrictions', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = replaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    await prisma.$transaction([
      prisma.dumpingRestriction.deleteMany({}),
      prisma.dumpingRestriction.createMany({
        data: parsed.data.restrictions.map((text, index) => ({ text, sortOrder: index })),
      }),
    ]);

    return reply.send({ restrictions: parsed.data.restrictions });
  });
}
