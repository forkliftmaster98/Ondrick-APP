import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { prisma } from './db/prisma.js';
import { authRoutes } from './modules/auth/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { dumpingRoutes } from './modules/dumping/routes.js';
import { toolsRoutes } from './modules/tools/routes.js';
import { clearanceRoutes } from './modules/clearance/routes.js';
import { eventsRoutes } from './modules/events/routes.js';
import { teamRoutes } from './modules/team/routes.js';
import { contractorDocsRoutes } from './modules/contractor-docs/routes.js';
import { contractorRoutes } from './modules/contractor/routes.js';
import { quotesRoutes } from './modules/quotes/routes.js';
import { reviewsRoutes } from './modules/reviews/routes.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cookie);
  // global: false — most routes aren't rate-limited; /auth/login opts in
  // with its own stricter per-IP+email config.
  app.register(rateLimit, { global: false });

  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'ok' });
    } catch (err) {
      app.log.error(err, 'health check: database unreachable');
      return reply.status(503).send({ status: 'ok', db: 'unreachable' });
    }
  });

  // Public reads — no auth, per BACKEND_SPEC.md: the whole catalog should
  // be browsable without an account.
  app.register(catalogRoutes);
  app.register(dumpingRoutes);
  app.register(toolsRoutes);
  app.register(clearanceRoutes);
  app.register(eventsRoutes);
  app.register(teamRoutes);
  app.register(contractorDocsRoutes);

  app.register(authRoutes);
  app.register(contractorRoutes);
  app.register(quotesRoutes);
  app.register(reviewsRoutes);

  return app;
}
