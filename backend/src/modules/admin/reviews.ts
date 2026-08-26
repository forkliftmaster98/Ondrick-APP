import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

// visible=false is an after-the-fact takedown (spam/abuse), never a
// pre-publish gate — reviews are public and unmoderated by default (see
// modules/reviews/routes.ts).
const updateSchema = z.object({ visible: z.boolean() });
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReviewsRoutes(app: FastifyInstance) {
  app.patch('/admin/reviews/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const review = await prisma.review.update({
        where: { id: params.data.id },
        data: { visible: body.data.visible },
      });
      return reply.send({
        review: {
          id: review.id,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
          visible: review.visible,
        },
      });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
