import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, sessionCookieHeader } from './helpers.js';

describe('contractor verification + trade pricing', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('unverified users see list price only; a bad code is rejected', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'unverified@example.com', password: 'correcthorsebattery', name: 'U', phone: '555-1' },
    });
    const cookie = sessionCookieHeader(signup);

    const catalog = await app.inject({ method: 'GET', url: '/material-categories', headers: { cookie } });
    const product = catalog.json()[0].products[0];
    expect(product.tradePricePerYard).toBeNull();

    const badCode = await app.inject({
      method: 'POST',
      url: '/me/verify-contractor',
      headers: { cookie },
      payload: { code: 'NOTREAL' },
    });
    expect(badCode.statusCode).toBe(400);
  });

  it('a valid (case-insensitive) code verifies the account and unlocks the 10% trade price', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'contractor@example.com', password: 'correcthorsebattery', name: 'C', phone: '555-2' },
    });
    const cookie = sessionCookieHeader(signup);

    const verify = await app.inject({
      method: 'POST',
      url: '/me/verify-contractor',
      headers: { cookie },
      payload: { code: 'ondrickpro0' }, // seeded code, lowercase on purpose
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().user.role).toBe('CONTRACTOR');
    expect(verify.json().user.contractorVerifiedAt).not.toBeNull();

    const catalog = await app.inject({ method: 'GET', url: '/material-categories', headers: { cookie } });
    const product = catalog.json()[0].products.find((p: { name: string }) => p.name === 'Deluxe Red Cedar');
    expect(product.pricePerYard).toBe(44);
    expect(product.tradePricePerYard).toBe(39.6); // round(44 * 0.9, 2)
  });

  it('rate-limits repeated code guesses on the same session', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'guesser@example.com', password: 'correcthorsebattery', name: 'G', phone: '555-3' },
    });
    const cookie = sessionCookieHeader(signup);

    const attempt = (code: string) =>
      app.inject({ method: 'POST', url: '/me/verify-contractor', headers: { cookie }, payload: { code } });

    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(await attempt(`NOTREAL${i}`)); // none of these are the seeded code
    }
    expect(results.slice(0, 10).every((r) => r.statusCode === 400)).toBe(true);
    expect(results[10]!.statusCode).toBe(429);
  });
});
