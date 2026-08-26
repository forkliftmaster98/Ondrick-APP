import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';
import { computeLineItem } from '../../lib/line-item.js';
import { shapeSchema } from '../../lib/shape-schema.js';
import { requireAuth } from '../../middleware/auth.js';
import { serializeCart } from './serialize.js';

const addItemSchema = z.object({
  productId: z.string().uuid(),
  shapeInput: shapeSchema,
  depthIn: z.number().positive().optional(),
  wastePct: z.number().min(0).max(100),
});

const paramsSchema = z.object({ id: z.string().uuid() });

// Cart only persists for signed-in accounts — requireAuth on every route
// here. Anonymous browsing keeps its cart client-side only; there's
// nothing server-side to save until there's a profile to save it against.
async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: { items: true },
  });
}

export async function cartRoutes(app: FastifyInstance) {
  app.get('/cart', { preHandler: requireAuth }, async (request, reply) => {
    const cart = await getOrCreateCart(request.currentUser!.id);
    return reply.send({ cart: serializeCart(cart) });
  });

  app.post('/cart/items', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = addItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const product = await prisma.materialProduct.findUnique({
      where: { id: parsed.data.productId },
      include: { category: true },
    });
    if (!product || !product.active) {
      return reply.status(400).send({ error: 'invalid_product' });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.id } });
    const verified = user.role === 'CONTRACTOR' && user.contractorVerifiedAt !== null;
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const discountPct = settings ? (num(settings.tradeDiscountPct) as number) : null;

    const line = computeLineItem({
      product,
      category: product.category,
      shapeInput: parsed.data.shapeInput,
      depthIn: parsed.data.depthIn,
      wastePct: parsed.data.wastePct,
      verified,
      discountPct,
    });

    const cart = await getOrCreateCart(user.id);
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        categoryName: line.categoryName,
        productName: line.productName,
        shapeSummary: line.shapeSummary,
        depthIn: line.depthIn,
        wastePct: line.wastePct,
        yards: line.yards,
        bags: line.bags,
        weightLb: line.weightLb,
        cost: line.cost,
        pricePerYardSnapshot: line.pricePerYardUsed,
      },
    });

    const updated = await getOrCreateCart(user.id);
    return reply.status(201).send({ cart: serializeCart(updated) });
  });

  app.delete('/cart/items/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }

    const cart = await prisma.cart.findUnique({ where: { userId: request.currentUser!.id } });
    if (!cart) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const { count } = await prisma.cartItem.deleteMany({
      where: { id: parsedParams.data.id, cartId: cart.id },
    });
    if (count === 0) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const updated = await getOrCreateCart(request.currentUser!.id);
    return reply.send({ cart: serializeCart(updated) });
  });

  app.delete('/cart', { preHandler: requireAuth }, async (request, reply) => {
    const cart = await prisma.cart.findUnique({ where: { userId: request.currentUser!.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return reply.status(204).send();
  });
}
