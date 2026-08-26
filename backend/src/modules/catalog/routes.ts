import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';
import { applyTradeDiscount, isVerifiedContractor } from '../../lib/pricing.js';
import { optionalAuth } from '../../middleware/auth.js';

export async function catalogRoutes(app: FastifyInstance) {
  // No requireAuth — the catalog must stay browsable without an account —
  // but optionalAuth lets a verified contractor's session unlock
  // tradePricePerYard on the same response shape everyone else gets.
  app.get('/material-categories', { preHandler: optionalAuth }, async (request) => {
    const [categories, settings] = await Promise.all([
      prisma.materialCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      prisma.settings.findUnique({ where: { id: 1 } }),
    ]);

    const verified = isVerifiedContractor(request.currentUser);
    const discountPct = settings ? num(settings.tradeDiscountPct) : null;

    return categories.map((category) => ({
      key: category.key,
      name: category.name,
      hint: category.hint,
      typicalDepthIn: num(category.typicalDepthIn),
      weightPerYardLb: category.weightPerYardLb,
      imageUrl: category.imageUrl,
      products: category.products.map((product) => {
        const listPrice = num(product.pricePerYard) as number;
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          pricePerYard: listPrice,
          tradePricePerYard:
            verified && discountPct !== null ? applyTradeDiscount(listPrice, discountPct) : null,
          typicalDepthIn: num(product.typicalDepthIn),
          imageUrl: product.imageUrl,
        };
      }),
    }));
  });
}
