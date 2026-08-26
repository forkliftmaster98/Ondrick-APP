import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

// fileUrl is null until the Phase 6 storage/signing pipeline lands — the
// shape is stable now so clients can build against it ahead of that.
export async function contractorDocsRoutes(app: FastifyInstance) {
  app.get('/contractor-docs', async () => {
    const docs = await prisma.contractorDoc.findMany({
      orderBy: { name: 'asc' },
    });

    return docs.map((doc) => ({
      key: doc.key,
      name: doc.name,
      updatedLabel: doc.updatedLabel,
      fileUrl: null as string | null,
    }));
  });
}
