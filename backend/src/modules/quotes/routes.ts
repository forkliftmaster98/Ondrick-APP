import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { calculate, type ShapeInput } from '../../lib/calculator.js';
import { num } from '../../lib/decimal.js';
import { sendEmail } from '../../lib/email.js';
import { applyTradeDiscount } from '../../lib/pricing.js';
import { requireAuth } from '../../middleware/auth.js';
import { buildCustomerEmailBody, buildStaffEmailBody } from './notify.js';
import { serializeQuote } from './serialize.js';

const shapeSchema: z.ZodType<ShapeInput> = z.discriminatedUnion('shape', [
  z.object({ shape: z.literal('rect'), lengthFt: z.number().positive(), widthFt: z.number().positive() }),
  z.object({ shape: z.literal('circle'), diameterFt: z.number().positive() }),
  z.object({ shape: z.literal('manual'), sqft: z.number().positive() }),
]);

const quoteItemSchema = z.object({
  productId: z.string().uuid(),
  shapeInput: shapeSchema,
  depthIn: z.number().positive().optional(),
  wastePct: z.number().min(0).max(100),
});

const submitQuoteSchema = z.object({
  items: z.array(quoteItemSchema).min(1),
  fulfillment: z.enum(['DELIVERY', 'PICKUP']),
  contactName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  address: z.string().trim().min(1).max(500),
  driverNotes: z.string().trim().max(1000).optional(),
});

export async function quotesRoutes(app: FastifyInstance) {
  // Requires an authenticated account (requireAuth), per BACKEND_SPEC.md:
  // "submitting a quote requires a signed-in account." Every number in the
  // response is computed here from current product data — the client sends
  // only the shape/depth/waste inputs and a product id, never a cost, so a
  // tampered request can't lowball a quote.
  app.post('/quotes', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = submitQuoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { items, fulfillment, contactName, phone, email, address, driverNotes } = parsed.data;

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.materialProduct.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.active) {
        return reply.status(400).send({ error: 'invalid_product', productId: item.productId });
      }
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.currentUser!.id },
      include: { contractorCode: true },
    });
    const verified = user.role === 'CONTRACTOR' && user.contractorVerifiedAt !== null;

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const discountPct = settings ? (num(settings.tradeDiscountPct) as number) : null;
    const discountSourceLabel = verified
      ? (user.contractorCode?.label ?? user.contractorCode?.code ?? null)
      : null;

    const computedItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const listPrice = num(product.pricePerYard) as number;
      const pricePerYard =
        verified && discountPct !== null ? applyTradeDiscount(listPrice, discountPct) : listPrice;
      const fallbackDepthIn = (num(product.typicalDepthIn) ?? num(product.category.typicalDepthIn)) as number;

      const result = calculate({
        shapeInput: item.shapeInput,
        depthIn: item.depthIn ?? null,
        fallbackDepthIn,
        wastePct: item.wastePct,
        pricePerYard,
        weightPerYardLb: product.category.weightPerYardLb,
      });

      return {
        categoryName: product.category.name,
        productName: product.name,
        shapeSummary: result.shapeSummary,
        depthIn: result.depthIn,
        wastePct: item.wastePct,
        yards: result.yards,
        bags: result.bags,
        weightLb: result.weightLb,
        cost: result.cost,
      };
    });

    const total = Math.round(computedItems.reduce((sum, item) => sum + item.cost, 0) * 100) / 100;

    const quote = await prisma.quote.create({
      data: {
        userId: user.id,
        fulfillment,
        total,
        contactName,
        phone,
        email,
        address,
        driverNotes,
        discountPct: verified ? discountPct : null,
        discountSourceLabel,
        items: { create: computedItems },
      },
      include: { items: true },
    });

    const serialized = serializeQuote(quote);
    await Promise.all([
      sendEmail(app.log, {
        to: env.YARD_NOTIFICATION_EMAIL,
        subject: `New quote request — ${contactName}`,
        text: buildStaffEmailBody(serialized),
      }),
      sendEmail(app.log, {
        to: email,
        subject: 'We received your Ondrick quote request',
        text: buildCustomerEmailBody(serialized),
      }),
    ]);

    return reply.status(201).send({ quote: serialized });
  });

  app.get('/me/quotes', { preHandler: requireAuth }, async (request, reply) => {
    const quotes = await prisma.quote.findMany({
      where: { userId: request.currentUser!.id },
      orderBy: { submittedAt: 'desc' },
      include: { items: true },
    });
    return reply.send({ quotes: quotes.map(serializeQuote) });
  });
}
