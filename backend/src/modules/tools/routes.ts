import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function toolsRoutes(app: FastifyInstance) {
  app.get('/tools', async () => {
    const tools = await prisma.tool.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    return tools.map((tool) => ({
      key: tool.key,
      name: tool.name,
      note: tool.note,
      priceLabel: tool.priceLabel,
      imageUrl: tool.imageUrl,
    }));
  });
}
