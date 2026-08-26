import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function dumpingRoutes(app: FastifyInstance) {
  app.get('/dumping-items', async () => {
    const [items, restrictions] = await Promise.all([
      prisma.dumpingItem.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.dumpingRestriction.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    return {
      items: items.map((item) => ({
        key: item.key,
        name: item.name,
        priceLabel: item.priceLabel,
        priceNote: item.priceNote,
        rules: item.rules,
      })),
      restrictions: restrictions.map((r) => r.text),
    };
  });
}
