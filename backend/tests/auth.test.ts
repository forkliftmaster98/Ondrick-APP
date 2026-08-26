import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createTestApp, sessionCookieHeader } from './helpers.js';

const emailState = vi.hoisted(() => ({ sent: [] as Array<{ to: string; subject: string; text: string }> }));

vi.mock('../src/lib/email.js', () => ({
  sendEmail: async (_logger: unknown, message: { to: string; subject: string; text: string }) => {
    emailState.sent.push(message);
  },
}));

describe('auth', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    emailState.sent.length = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  it('normalizes email (trim + lowercase) and dedupes on it', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: ' Jane.Doe@Example.com ', password: 'correcthorsebattery', name: 'Jane', phone: '555-1' },
    });
    expect(signup.statusCode).toBe(201);
    expect(signup.json().user.email).toBe('jane.doe@example.com');

    const dupe = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'jane.doe@example.com', password: 'anotherpassword', name: 'Jane Dupe', phone: '555-2' },
    });
    expect(dupe.statusCode).toBe(409);
  });

  it('rejects /me without a session and accepts it with one', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/me' });
    expect(noAuth.statusCode).toBe(401);

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'me-test@example.com', password: 'correcthorsebattery', name: 'Me Test', phone: '555-3' },
    });
    const cookie = sessionCookieHeader(signup);

    const me = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('me-test@example.com');
  });

  it('PATCH /me updates profile fields', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'patch-test@example.com', password: 'correcthorsebattery', name: 'Patch Test', phone: '555-4' },
    });
    const cookie = sessionCookieHeader(signup);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { address: '1 Main St', driverNotes: 'Gate code 4477' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().user.address).toBe('1 Main St');
    expect(patch.json().user.driverNotes).toBe('Gate code 4477');
  });

  it('login: generic 401 on bad email or bad password, 200 on match', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'login-test@example.com', password: 'correcthorsebattery', name: 'Login Test', phone: '555-5' },
    });

    const badEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'correcthorsebattery' },
    });
    const badPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login-test@example.com', password: 'wrongpassword' },
    });
    expect(badEmail.statusCode).toBe(401);
    expect(badPassword.statusCode).toBe(401);
    expect(badEmail.json()).toEqual(badPassword.json());

    const good = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login-test@example.com', password: 'correcthorsebattery' },
    });
    expect(good.statusCode).toBe(200);
  });

  it('logout invalidates the session', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'logout-test@example.com', password: 'correcthorsebattery', name: 'Logout Test', phone: '555-6' },
    });
    const cookie = sessionCookieHeader(signup);

    const logout = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(204);

    const meAfter = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(meAfter.statusCode).toBe(401);
  });

  it('rate-limits /auth/login per IP+email without blocking a different email', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ratelimit-test@example.com', password: 'correcthorsebattery', name: 'RL Test', phone: '555-7' },
    });

    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ratelimit-test@example.com', password: 'wrongpassword' },
      });

    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await attempt());
    }
    expect(results.slice(0, 5).every((r) => r.statusCode === 401)).toBe(true);
    expect(results[5]!.statusCode).toBe(429);

    const otherEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'someone-else@example.com', password: 'wrongpassword' },
    });
    expect(otherEmail.statusCode).toBe(401); // not 429 — different key
  });

  it('forgot/reset: single-use token, invalidates existing sessions, old password stops working', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'reset-test@example.com', password: 'oldpassword123', name: 'Reset Test', phone: '555-8' },
    });
    const oldCookie = sessionCookieHeader(signup);

    const forgot = await app.inject({
      method: 'POST',
      url: '/auth/forgot',
      payload: { email: 'reset-test@example.com' },
    });
    expect(forgot.statusCode).toBe(200);

    const forgotUnknown = await app.inject({
      method: 'POST',
      url: '/auth/forgot',
      payload: { email: 'nobody@example.com' },
    });
    expect(forgotUnknown.statusCode).toBe(200); // no enumeration signal

    expect(emailState.sent).toHaveLength(1); // only the real account gets an email
    const match = emailState.sent[0]!.text.match(/expires in 30 minutes\): ([0-9a-f]+)/);
    expect(match).not.toBeNull();
    const token = match![1]!;

    const badToken = await app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: 'garbage', password: 'newpassword456' },
    });
    expect(badToken.statusCode).toBe(400);

    const reset = await app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token, password: 'newpassword456' },
    });
    expect(reset.statusCode).toBe(200);

    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token, password: 'anotherone789' },
    });
    expect(reuse.statusCode).toBe(400); // single-use

    const oldSessionAfterReset = await app.inject({ method: 'GET', url: '/me', headers: { cookie: oldCookie } });
    expect(oldSessionAfterReset.statusCode).toBe(401); // reset revoked existing sessions

    const loginOldPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset-test@example.com', password: 'oldpassword123' },
    });
    expect(loginOldPassword.statusCode).toBe(401);

    const loginNewPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset-test@example.com', password: 'newpassword456' },
    });
    expect(loginNewPassword.statusCode).toBe(200);
  });

  it('admin_emails allowlist grants isAdmin at signup', async () => {
    await prisma.adminEmail.create({ data: { email: 'preapproved-admin@example.com' } });

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'preapproved-admin@example.com',
        password: 'correcthorsebattery',
        name: 'Admin Person',
        phone: '555-9',
      },
    });
    expect(signup.json().user.isAdmin).toBe(true);
  });
});
