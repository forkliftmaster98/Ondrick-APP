import Fastify from 'fastify';
import { prisma } from './db/prisma.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'ok' });
    } catch (err) {
      app.log.error(err, 'health check: database unreachable');
      return reply.status(503).send({ status: 'ok', db: 'unreachable' });
    }
  });

  return app;
}
