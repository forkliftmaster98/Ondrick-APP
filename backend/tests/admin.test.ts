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

  async function createAdminCookie(email: string): Promise<string> {
    await prisma.adminEmail.create({ data: { email } });
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'correcthorsebattery', name: 'Admin', phone: '555-0' },
    });
    return sessionCookieHeader(signup);
  }

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

  it('GET admin list endpoints expose the id of seeded rows, not just ones created this session', async () => {
    const cookie = await createAdminCookie('admin4@example.com');

    // Seeded by prisma/seed-data.ts (via tests/db.ts's resetDatabase) — a
    // real dump/tool/product with no id ever surfaced through the public
    // read, which never returns one. Without a GET admin list endpoint
    // there'd be no way to obtain the id PATCH/DELETE require for these.
    const dumpingItems = await app.inject({ method: 'GET', url: '/admin/dumping-items', headers: { cookie } });
    expect(dumpingItems.statusCode).toBe(200);
    const seededDumpingItem = dumpingItems.json().items.find((i: { key: string }) => i.key === 'yard');
    expect(seededDumpingItem.id).toEqual(expect.any(String));

    const tools = await app.inject({ method: 'GET', url: '/admin/tools', headers: { cookie } });
    expect(tools.statusCode).toBe(200);
    expect(tools.json().tools.find((t: { key: string }) => t.key === 't1').id).toEqual(expect.any(String));

    const products = await app.inject({ method: 'GET', url: '/admin/material-products', headers: { cookie } });
    expect(products.statusCode).toBe(200);
    const cedar = products.json().products.find((p: { name: string }) => p.name === 'Deluxe Red Cedar');
    expect(cedar.id).toEqual(expect.any(String));
    expect(cedar.pricePerYard).toBe(44); // numeric, not a Decimal-as-string

    // Deactivating a product hides it from the public catalog but it must
    // still be discoverable (and reactivatable) via the admin list.
    const deactivate = await app.inject({
      method: 'PATCH',
      url: `/admin/material-products/${cedar.id}`,
      headers: { cookie },
      payload: { active: false },
    });
    expect(deactivate.statusCode).toBe(200);

    const publicCatalog = await app.inject({ method: 'GET', url: '/material-categories' });
    const stillPublic = publicCatalog
      .json()
      .flatMap((c: { products: Array<{ name: string }> }) => c.products)
      .some((p: { name: string }) => p.name === 'Deluxe Red Cedar');
    expect(stillPublic).toBe(false);

    const adminListAfterDeactivate = await app.inject({
      method: 'GET',
      url: '/admin/material-products',
      headers: { cookie },
    });
    const stillInAdminList = adminListAfterDeactivate
      .json()
      .products.some((p: { id: string }) => p.id === cedar.id);
    expect(stillInAdminList).toBe(true);
  });

  it('signup handles a concurrent duplicate email as 409, never a 500', async () => {
    const payload = { email: 'race@example.com', password: 'correcthorsebattery', name: 'Race', phone: '555-5' };
    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: '/auth/signup', payload }),
      app.inject({ method: 'POST', url: '/auth/signup', payload }),
    ]);
    const codes = [first.statusCode, second.statusCode].sort();
    expect(codes).toEqual([201, 409]);
  });
});
