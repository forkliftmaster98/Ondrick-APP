import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/material-categories', async () => {
    const categories = await prisma.materialCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return categories.map((category) => ({
      key: category.key,
      name: category.name,
      hint: category.hint,
      typicalDepthIn: num(category.typicalDepthIn),
      weightPerYardLb: category.weightPerYardLb,
      imageUrl: category.imageUrl,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        pricePerYard: num(product.pricePerYard),
        typicalDepthIn: num(product.typicalDepthIn),
        imageUrl: product.imageUrl,
      })),
    }));
  });
}
