import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createTestApp, sessionCookieHeader } from './helpers.js';

describe('reviews', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires auth to post, but a posted review is public and unmoderated immediately — even a bad one', async () => {
    const unauth = await app.inject({ method: 'POST', url: '/reviews', payload: { rating: 5, text: 'great' } });
    expect(unauth.statusCode).toBe(401);

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'reviewer@example.com', password: 'correcthorsebattery', name: 'Reviewer', phone: '555-1' },
    });
    const cookie = sessionCookieHeader(signup);

    const post = await app.inject({
      method: 'POST',
      url: '/reviews',
      headers: { cookie },
      payload: { rating: 1, text: 'Truck was late.' },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json().review.visible).toBe(true);

    const publicList = await app.inject({ method: 'GET', url: '/reviews' });
    const found = publicList.json().reviews.find((r: { id: string }) => r.id === post.json().review.id);
    expect(found).toBeDefined();
    expect(found.reviewerName).toBe('Reviewer');
  });

  it('admin takedown hides a review from the public list', async () => {
    await prisma.adminEmail.create({ data: { email: 'review-admin@example.com' } });
    const adminSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'review-admin@example.com', password: 'correcthorsebattery', name: 'Admin', phone: '555-2' },
    });
    const adminCookie = sessionCookieHeader(adminSignup);

    const reviewerSignup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'reviewer2@example.com', password: 'correcthorsebattery', name: 'R2', phone: '555-3' },
    });
    const reviewerCookie = sessionCookieHeader(reviewerSignup);

    const post = await app.inject({
      method: 'POST',
      url: '/reviews',
      headers: { cookie: reviewerCookie },
      payload: { rating: 2, text: 'spammy content' },
    });
    const reviewId = post.json().review.id;

    const takedown = await app.inject({
      method: 'PATCH',
      url: `/admin/reviews/${reviewId}`,
      headers: { cookie: adminCookie },
      payload: { visible: false },
    });
    expect(takedown.statusCode).toBe(200);

    const publicList = await app.inject({ method: 'GET', url: '/reviews' });
    expect(publicList.json().reviews.some((r: { id: string }) => r.id === reviewId)).toBe(false);
  });
});
