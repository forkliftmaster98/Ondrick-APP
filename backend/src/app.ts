import Fastify from 'fastify';
import { prisma } from './db/prisma.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { dumpingRoutes } from './modules/dumping/routes.js';
import { toolsRoutes } from './modules/tools/routes.js';
import { clearanceRoutes } from './modules/clearance/routes.js';
import { eventsRoutes } from './modules/events/routes.js';
import { teamRoutes } from './modules/team/routes.js';
import { contractorDocsRoutes } from './modules/contractor-docs/routes.js';

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

  // Public reads — no auth, per BACKEND_SPEC.md: the whole catalog should
  // be browsable without an account.
  app.register(catalogRoutes);
  app.register(dumpingRoutes);
  app.register(toolsRoutes);
  app.register(clearanceRoutes);
  app.register(eventsRoutes);
  app.register(teamRoutes);
  app.register(contractorDocsRoutes);

  return app;
}
