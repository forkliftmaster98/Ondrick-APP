import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(2000),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().uuid().optional(),
});

export async function reviewsRoutes(app: FastifyInstance) {
  // Public and unmoderated by default — reviews go live the moment they're
  // submitted, per the product decision to show bad reviews rather than
  // gate on approval. visible=false remains as an after-the-fact takedown
  // for spam/abuse (admin-only, added in the Phase 5 admin work), never a
  // pre-publish gate.
  app.get('/reviews', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }
    const { limit, cursor } = parsed.data;

    const reviews = await prisma.review.findMany({
      where: { visible: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { name: true } } },
    });

    const hasMore = reviews.length > limit;
    const page = reviews.slice(0, limit);

    return reply.send({
      reviews: page.map((review) => ({
        id: review.id,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt,
        reviewerName: review.user.name,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  });

  app.post('/reviews', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const review = await prisma.review.create({
      data: {
        userId: request.currentUser!.id,
        rating: parsed.data.rating,
        text: parsed.data.text,
      },
    });

    return reply.status(201).send({
      review: {
        id: review.id,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt,
        visible: review.visible,
      },
    });
  });
}
