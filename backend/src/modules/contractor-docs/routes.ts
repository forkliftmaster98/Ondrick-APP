import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { getStorage } from '../../lib/storage/index.js';

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

// Metadata stays public per BACKEND_SPEC.md ("the whole catalog should be
// browsable without an account"), but the actual fileUrl is a freshly
// signed, short-lived download link generated on every read — never a
// stored, indefinitely-valid URL.
export async function contractorDocsRoutes(app: FastifyInstance) {
  app.get('/contractor-docs', async () => {
    const docs = await prisma.contractorDoc.findMany({
      orderBy: { name: 'asc' },
    });

    const storage = getStorage();
    return Promise.all(
      docs.map(async (doc) => ({
        key: doc.key,
        name: doc.name,
        updatedLabel: doc.updatedLabel,
        fileUrl: await storage.getSignedDownloadUrl(doc.fileKey, DOWNLOAD_URL_TTL_SECONDS),
      })),
    );
  });
}
