import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';
import { serializeQuote } from '../quotes/serialize.js';

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
});
const updateSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
});
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminQuotesRoutes(app: FastifyInstance) {
  app.get('/admin/quotes', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }
    const quotes = await prisma.quote.findMany({
      where: parsed.data.status ? { status: parsed.data.status } : {},
      orderBy: { submittedAt: 'desc' },
      include: { items: true },
    });
    return reply.send({ quotes: quotes.map(serializeQuote) });
  });

  app.patch('/admin/quotes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const quote = await prisma.quote.update({
        where: { id: params.data.id },
        data: { status: body.data.status },
        include: { items: true },
      });
      return reply.send({ quote: serializeQuote(quote) });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
