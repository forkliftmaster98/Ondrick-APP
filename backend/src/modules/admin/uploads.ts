import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildObjectKey } from '../../lib/storage/types.js';
import { getStorage } from '../../lib/storage/index.js';
import { requireAdmin } from '../../middleware/auth.js';

const signSchema = z.object({
  purpose: z.enum(['materials', 'team', 'clearance', 'tools', 'contractor-docs']),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
});

// The client PUTs the raw file to `uploadUrl`, then PATCHes the owning
// resource with `publicUrl` (material-products.imageUrl, team-members.photoUrl,
// etc.) or, for contractor docs, with `key` as contractor_docs.fileKey —
// GET /contractor-docs re-signs a fresh download URL from that key on
// every read rather than storing a URL that could expire.
export async function adminUploadsRoutes(app: FastifyInstance) {
  app.post('/admin/uploads/sign', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = signSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const key = buildObjectKey(parsed.data.purpose, parsed.data.filename);
    const storage = getStorage();
    const { uploadUrl, method } = await storage.createUploadTarget(key, parsed.data.contentType);

    return reply.status(201).send({
      key,
      uploadUrl,
      method,
      publicUrl: parsed.data.purpose === 'contractor-docs' ? null : storage.getPublicUrl(key),
    });
  });
}
