import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function clearanceRoutes(app: FastifyInstance) {
  app.get('/clearance-items', async () => {
    const items = await prisma.clearanceItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => ({
      key: item.key,
      name: item.name,
      note: item.note,
      priceLabel: item.priceLabel,
      wasPriceLabel: item.wasPriceLabel,
      qtyLabel: item.qtyLabel,
    }));
  });
}
