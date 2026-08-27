import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { getStorage } from '../../lib/storage/index.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

// fileKey is a storage object key/path, not a public URL — an admin sets
// it after uploading via POST /admin/uploads/sign (purpose: 'contractor-docs').
const createSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  updatedLabel: z.string().trim().max(100).optional(),
  fileKey: z.string().trim().min(1).max(500),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminContractorDocsRoutes(app: FastifyInstance) {
  // Also includes a freshly-signed download link per doc (admins need to
  // find the id for PATCH/DELETE, and a way to check what they uploaded).
  app.get('/admin/contractor-docs', { preHandler: requireAdmin }, async (_request, reply) => {
    const docs = await prisma.contractorDoc.findMany({ orderBy: { name: 'asc' } });
    const storage = getStorage();
    const withUrls = await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        fileUrl: await storage.getSignedDownloadUrl(doc.fileKey, DOWNLOAD_URL_TTL_SECONDS),
      })),
    );
    return reply.send({ docs: withUrls });
  });

  app.post('/admin/contractor-docs', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const existing = await prisma.contractorDoc.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      return reply.status(409).send({ error: 'key_taken' });
    }
    const doc = await prisma.contractorDoc.create({ data: parsed.data });
    return reply.status(201).send({ doc });
  });

  app.patch('/admin/contractor-docs/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    try {
      const doc = await prisma.contractorDoc.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ doc });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/contractor-docs/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.contractorDoc.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
