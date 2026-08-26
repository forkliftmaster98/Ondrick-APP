import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { localObjectPath, verifyLocalUploadToken } from '../../lib/storage/local.js';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

const tokenQuerySchema = z.object({
  token: z.string().min(1),
  expires: z.coerce.number().int().positive(),
});

// Only meaningful when STORAGE_DRIVER=local (see lib/storage) — the dev/test
// stand-in for a real object store, serving exactly the shape a presigned
// S3 URL would: PUT the bytes to a token-authorized URL, GET them back
// either freely (public/... prefix, e.g. material images) or with the same
// token (private/... prefix, e.g. contractor docs).
export async function uploadsRoutes(app: FastifyInstance) {
  app.put('/uploads/*', async (request, reply) => {
    const key = (request.params as { '*': string })['*'];
    const query = tokenQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'invalid_query' });
    }
    if (!verifyLocalUploadToken(key, query.data.expires, query.data.token)) {
      return reply.status(403).send({ error: 'invalid_or_expired_token' });
    }
    if (!Buffer.isBuffer(request.body)) {
      return reply.status(400).send({ error: 'expected_binary_body' });
    }

    const filePath = localObjectPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, request.body);

    return reply.status(201).send({ status: 'ok' });
  });

  app.get('/uploads/*', async (request, reply) => {
    const key = (request.params as { '*': string })['*'];
    // Fail closed: only a key explicitly under public/ skips the token
    // check. Anything else — private/..., or a fileKey an admin set by
    // hand that doesn't match either prefix (e.g. this project's own
    // pre-Phase-6 seed data) — must present a valid token. The inverse
    // (gate only on a recognized private/ prefix) would silently serve an
    // ungated file for any key that simply forgot the prefix.
    const isPublic = key.startsWith('public/');

    if (!isPublic) {
      const query = tokenQuerySchema.safeParse(request.query);
      if (!query.success || !verifyLocalUploadToken(key, query.data.expires, query.data.token)) {
        return reply.status(403).send({ error: 'invalid_or_expired_token' });
      }
    }

    const filePath = localObjectPath(key);
    try {
      await stat(filePath);
    } catch {
      return reply.status(404).send({ error: 'not_found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    reply.header('content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
    return reply.send(createReadStream(filePath));
  });
}
