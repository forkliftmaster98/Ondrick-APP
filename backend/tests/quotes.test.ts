import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createTestApp, sessionCookieHeader } from './helpers.js';

async function getCedarProductId(): Promise<string> {
  const product = await prisma.materialProduct.findFirstOrThrow({ where: { name: 'Deluxe Red Cedar' } });
  return product.id;
}

const emailState = vi.hoisted(() => ({ sent: [] as Array<{ to: string; subject: string; text: string }> }));

vi.mock('../src/lib/email.js', () => ({
  sendEmail: async (_logger: unknown, message: { to: string; subject: string; text: string }) => {
    emailState.sent.push(message);
  },
}));

describe('quotes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    emailState.sent.length = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires a signed-in account', async () => {
    const productId = await getCedarProductId();
    const res = await app.inject({
      method: 'POST',
      url: '/quotes',
      payload: {
        items: [{ productId, shapeInput: { shape: 'manual', sqft: 100 }, wastePct: 0 }],
        fulfillment: 'DELIVERY',
        contactName: 'X',
        phone: '555-0',
        email: 'x@example.com',
        address: '1 Main St',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('direct items[]: server recomputes and matches the known-good calculation, rejects an unknown product', async () => {
    const productId = await getCedarProductId();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'quote-direct@example.com', password: 'correcthorsebattery', name: 'Q', phone: '555-1' },
    });
    const cookie = sessionCookieHeader(signup);

    const invalid = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        items: [{ productId: '00000000-0000-0000-0000-000000000000', shapeInput: { shape: 'manual', sqft: 100 }, wastePct: 0 }],
        fulfillment: 'PICKUP',
        contactName: 'Q',
        phone: '555-1',
        email: 'quote-direct@example.com',
        address: '1 Main St',
      },
    });
    expect(invalid.statusCode).toBe(400);

    const res = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        items: [
          { productId, shapeInput: { shape: 'rect', lengthFt: 12, widthFt: 20 }, depthIn: 3, wastePct: 10 },
        ],
        fulfillment: 'DELIVERY',
        contactName: 'Q',
        phone: '555-1',
        email: 'quote-direct@example.com',
        address: '1 Main St',
      },
    });
    expect(res.statusCode).toBe(201);
    const quote = res.json().quote;
    expect(quote.total).toBe(107.56);
    expect(quote.items[0]).toMatchObject({ yards: 2.44, bags: 33, weightLb: 1222, cost: 107.56 });
  });

  it('cart-sourced submission freezes the add-time price against a later catalog change, and clears the cart', async () => {
    const productId = await getCedarProductId();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'quote-cart@example.com', password: 'correcthorsebattery', name: 'Q', phone: '555-2' },
    });
    const cookie = sessionCookieHeader(signup);

    const addToCart = await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { cookie },
      payload: {
        productId,
        shapeInput: { shape: 'manual', sqft: 324 },
        depthIn: 3,
        wastePct: 0,
      },
    });
    expect(addToCart.statusCode).toBe(201);
    const cartCostAtAddTime = addToCart.json().cart.items[0].cost;
    expect(cartCostAtAddTime).toBe(132); // 324*3/324 = 3 yards * $44

    // Yard raises the price after the item is already in the cart.
    await prisma.materialProduct.update({ where: { id: productId }, data: { pricePerYard: 99 } });

    const submit = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        fulfillment: 'DELIVERY',
        contactName: 'Q',
        phone: '555-2',
        email: 'quote-cart@example.com',
        address: '1 Main St',
      },
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().quote.total).toBe(cartCostAtAddTime); // frozen, not 297 (3 * $99)
    expect(submit.json().quote.items[0].cost).toBe(132);

    const cartAfter = await app.inject({ method: 'GET', url: '/cart', headers: { cookie } });
    expect(cartAfter.json().cart.items).toHaveLength(0);

    const resubmitEmptyCart = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        fulfillment: 'DELIVERY',
        contactName: 'Q',
        phone: '555-2',
        email: 'quote-cart@example.com',
        address: '1 Main St',
      },
    });
    expect(resubmitEmptyCart.statusCode).toBe(400);
  });

  it('discloses the contractor discount on the quote when applied', async () => {
    const productId = await getCedarProductId();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'quote-contractor@example.com', password: 'correcthorsebattery', name: 'Q', phone: '555-3' },
    });
    const cookie = sessionCookieHeader(signup);
    await app.inject({
      method: 'POST',
      url: '/me/verify-contractor',
      headers: { cookie },
      payload: { code: 'ONDRICKPRO0' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        items: [{ productId, shapeInput: { shape: 'manual', sqft: 324 }, depthIn: 3, wastePct: 0 }],
        fulfillment: 'PICKUP',
        contactName: 'Q',
        phone: '555-3',
        email: 'quote-contractor@example.com',
        address: '1 Main St',
      },
    });
    const quote = res.json().quote;
    expect(quote.discountPct).toBe(10);
    expect(quote.discountSourceLabel).toBe('Demo / seed code');
    expect(quote.total).toBe(118.8); // 3 yards * (44 * 0.9)
  });

  it('still records and discloses a 0% discount rather than treating it as no discount', async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { tradeDiscountPct: 0 } });

    const productId = await getCedarProductId();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'quote-zero-discount@example.com', password: 'correcthorsebattery', name: 'Q', phone: '555-4' },
    });
    const cookie = sessionCookieHeader(signup);
    await app.inject({
      method: 'POST',
      url: '/me/verify-contractor',
      headers: { cookie },
      payload: { code: 'ONDRICKPRO0' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/quotes',
      headers: { cookie },
      payload: {
        items: [{ productId, shapeInput: { shape: 'manual', sqft: 324 }, depthIn: 3, wastePct: 0 }],
        fulfillment: 'PICKUP',
        contactName: 'Q',
        phone: '555-4',
        email: 'quote-zero-discount@example.com',
        address: '1 Main St',
      },
    });
    const quote = res.json().quote;
    expect(quote.discountPct).toBe(0); // not null — a falsy check would have dropped this
    expect(quote.discountSourceLabel).toBe('Demo / seed code');

    const staffEmail = emailState.sent.find((m) => m.subject.startsWith('New quote request'));
    expect(staffEmail!.text).toContain('Discount applied: 0% off — Demo / seed code');
  });
});
