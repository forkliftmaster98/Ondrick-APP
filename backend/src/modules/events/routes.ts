import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

const querySchema = z.object({
  upcoming: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function eventsRoutes(app: FastifyInstance) {
  app.get('/events', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
      where: {
        active: true,
        ...(parsed.data.upcoming ? { startsOn: { gte: startOfToday } } : {}),
      },
      orderBy: { startsOn: 'asc' },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      startsOn: event.startsOn.toISOString().slice(0, 10),
      timeLabel: event.timeLabel,
      note: event.note,
    }));
  });
}
