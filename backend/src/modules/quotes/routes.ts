import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';
import { sendEmail } from '../../lib/email.js';
import { computeLineItem } from '../../lib/line-item.js';
import { shapeSchema } from '../../lib/shape-schema.js';
import { requireAuth } from '../../middleware/auth.js';
import { buildCustomerEmailBody, buildStaffEmailBody } from './notify.js';
import { serializeQuote } from './serialize.js';

const quoteItemSchema = z.object({
  productId: z.string().uuid(),
  shapeInput: shapeSchema,
  depthIn: z.number().positive().optional(),
  wastePct: z.number().min(0).max(100),
});

const submitQuoteSchema = z.object({
  // Omit entirely to submit the caller's persisted cart instead (see below).
  items: z.array(quoteItemSchema).min(1).optional(),
  fulfillment: z.enum(['DELIVERY', 'PICKUP']),
  contactName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  address: z.string().trim().min(1).max(500),
  driverNotes: z.string().trim().max(1000).optional(),
});

interface ComputedQuoteItem {
  categoryName: string;
  productName: string;
  shapeSummary: string;
  depthIn: number;
  wastePct: number;
  yards: number;
  bags: number;
  weightLb: number;
  cost: number;
}

export async function quotesRoutes(app: FastifyInstance) {
  // Requires an authenticated account (requireAuth), per BACKEND_SPEC.md:
  // "submitting a quote requires a signed-in account."
  //
  // Two ways to supply the line items:
  //  - `items` in the body: for a guest who calculated before signing in and
  //    has no persisted cart. Only shape/depth/waste/product-id are trusted
  //    from the client — cost is always recomputed here from current pricing.
  //  - `items` omitted: submit whatever is in the caller's persisted cart.
  //    Those rows are already frozen at add-to-cart time (see cart routes),
  //    so they're copied verbatim rather than recomputed — a catalog price
  //    change since the item was added must not silently shift this quote.
  //    The cart is cleared once the quote is created.
  app.post('/quotes', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = submitQuoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { items, fulfillment, contactName, phone, email, address, driverNotes } = parsed.data;

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

    let computedItems: ComputedQuoteItem[];
    let sourceCartId: string | null = null;

    if (items && items.length > 0) {
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

      computedItems = items.map((item) => {
        const product = productMap.get(item.productId)!;
        const line = computeLineItem({
          product,
          category: product.category,
          shapeInput: item.shapeInput,
          depthIn: item.depthIn,
          wastePct: item.wastePct,
          verified,
          discountPct,
        });
        return {
          categoryName: line.categoryName,
          productName: line.productName,
          shapeSummary: line.shapeSummary,
          depthIn: line.depthIn,
          wastePct: line.wastePct,
          yards: line.yards,
          bags: line.bags,
          weightLb: line.weightLb,
          cost: line.cost,
        };
      });
    } else {
      const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
      if (!cart || cart.items.length === 0) {
        return reply.status(400).send({ error: 'empty_cart' });
      }
      sourceCartId = cart.id;
      computedItems = cart.items.map((item) => ({
        categoryName: item.categoryName,
        productName: item.productName,
        shapeSummary: item.shapeSummary,
        depthIn: num(item.depthIn) as number,
        wastePct: num(item.wastePct) as number,
        yards: num(item.yards) as number,
        bags: item.bags,
        weightLb: item.weightLb,
        cost: num(item.cost) as number,
      }));
    }

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

    if (sourceCartId) {
      await prisma.cartItem.deleteMany({ where: { cartId: sourceCartId } });
    }

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
