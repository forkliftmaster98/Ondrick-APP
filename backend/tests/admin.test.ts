import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createTestApp, sessionCookieHeader } from './helpers.js';

describe('admin gating and CRUD', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('401 unauthenticated, 403 non-admin, 200 admin on the same route', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/admin/dumping-items',
      payload: { key: 'x', name: 'X', priceLabel: '$1', rules: 'none' },
    });
    expect(unauth.statusCode).toBe(401);

    const plainSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'plain@example.com', password: 'correcthorsebattery', name: 'Plain', phone: '555-1' },
    });
    const plainCookie = sessionCookieHeader(plainSignup);
    const forbidden = await app.inject({
      method: 'POST',
      url: '/admin/dumping-items',
      headers: { cookie: plainCookie },
      payload: { key: 'x', name: 'X', priceLabel: '$1', rules: 'none' },
    });
    expect(forbidden.statusCode).toBe(403);

    await prisma.adminEmail.create({ data: { email: 'admin@example.com' } });
    const adminSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'admin@example.com', password: 'correcthorsebattery', name: 'Admin', phone: '555-2' },
    });
    const adminCookie = sessionCookieHeader(adminSignup);
    const allowed = await app.inject({
      method: 'POST',
      url: '/admin/dumping-items',
      headers: { cookie: adminCookie },
      payload: { key: 'x', name: 'X', priceLabel: '$1', rules: 'none' },
    });
    expect(allowed.statusCode).toBe(201);
  });

  it('full CRUD lifecycle on dumping-items, visible through the public read', async () => {
    await prisma.adminEmail.create({ data: { email: 'admin2@example.com' } });
    const adminSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'admin2@example.com', password: 'correcthorsebattery', name: 'Admin', phone: '555-3' },
    });
    const cookie = sessionCookieHeader(adminSignup);

    const create = await app.inject({
      method: 'POST',
      url: '/admin/dumping-items',
      headers: { cookie },
      payload: { key: 'stump', name: 'Tree Stumps', priceLabel: '$25/c.y.', rules: 'Call ahead.' },
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().item.id;

    const dupe = await app.inject({
      method: 'POST',
      url: '/admin/dumping-items',
      headers: { cookie },
      payload: { key: 'stump', name: 'dupe', priceLabel: '$1', rules: 'x' },
    });
    expect(dupe.statusCode).toBe(409);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/admin/dumping-items/${id}`,
      headers: { cookie },
      payload: { priceLabel: '$30/c.y.' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().item.priceLabel).toBe('$30/c.y.');

    const publicRead = await app.inject({ method: 'GET', url: '/dumping-items' });
    const match = publicRead.json().items.find((i: { key: string }) => i.key === 'stump');
    expect(match.priceLabel).toBe('$30/c.y.');

    const del = await app.inject({ method: 'DELETE', url: `/admin/dumping-items/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);

    const delAgain = await app.inject({ method: 'DELETE', url: `/admin/dumping-items/${id}`, headers: { cookie } });
    expect(delAgain.statusCode).toBe(404);
  });

  it('settings PATCH updates trade discount and is reflected in catalog pricing', async () => {
    await prisma.adminEmail.create({ data: { email: 'admin3@example.com' } });
    const adminSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'admin3@example.com', password: 'correcthorsebattery', name: 'Admin', phone: '555-4' },
    });
    const cookie = sessionCookieHeader(adminSignup);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/admin/settings',
      headers: { cookie },
      payload: { tradeDiscountPct: 20 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().tradeDiscountPct).toBe(20);
  });
});
