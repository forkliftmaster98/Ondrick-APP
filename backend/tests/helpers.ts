import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE } from '../src/middleware/auth.js';

// A fresh app per test also gives each test its own in-memory rate-limit
// store, so /auth/login's 5-per-15min limit from one test never bleeds
// into the next.
export async function createTestApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.ready();
  return app;
}

export function sessionCookieHeader(response: LightMyRequestResponse): string {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) {
    throw new Error(`no ${SESSION_COOKIE} cookie in response (status ${response.statusCode})`);
  }
  return `${SESSION_COOKIE}=${cookie.value}`;
}

export async function signUpAndGetCookie(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; name: string; phone: string }> = {},
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: overrides.password ?? 'correcthorsebattery',
      name: overrides.name ?? 'Test User',
      phone: overrides.phone ?? '555-0000',
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`signup failed: ${response.statusCode} ${response.body}`);
  }
  return sessionCookieHeader(response);
}
