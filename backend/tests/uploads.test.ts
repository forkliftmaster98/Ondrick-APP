import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createTestApp, sessionCookieHeader } from './helpers.js';

describe('local upload/download pipeline', () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeEach(async () => {
    app = await createTestApp();
    await prisma.adminEmail.create({ data: { email: 'upload-admin@example.com' } });
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'upload-admin@example.com', password: 'correcthorsebattery', name: 'Admin', phone: '555-0' },
    });
    adminCookie = sessionCookieHeader(signup);
  });

  afterEach(async () => {
    await app.close();
  });

  it('round-trips a public image and preserves the declared content-type, not just the extension guess', async () => {
    const sign = await app.inject({
      method: 'POST',
      url: '/admin/uploads/sign',
      headers: { cookie: adminCookie },
      // .bin extension deliberately doesn't map to image/png in MIME_BY_EXT —
      // proves the response header comes from the declared type, not a guess.
      payload: { purpose: 'materials', filename: 'photo.bin', contentType: 'image/png' },
    });
    expect(sign.statusCode).toBe(201);
    const { uploadUrl, publicUrl } = sign.json();
    expect(publicUrl).not.toBeNull();

    const bytes = Buffer.from('fake-png-bytes');
    const uploadPath = uploadUrl.replace('http://localhost:3000', '');
    const put = await app.inject({ method: 'PUT', url: uploadPath, headers: { 'content-type': 'image/png' }, payload: bytes });
    expect(put.statusCode).toBe(201);

    const downloadPath = publicUrl.replace('http://localhost:3000', '');
    const get = await app.inject({ method: 'GET', url: downloadPath });
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toBe('image/png'); // not application/octet-stream from the .bin extension
    expect(get.rawPayload.equals(bytes)).toBe(true);
  });

  it('rejects a tampered or expired upload token', async () => {
    const sign = await app.inject({
      method: 'POST',
      url: '/admin/uploads/sign',
      headers: { cookie: adminCookie },
      payload: { purpose: 'materials', filename: 'x.png', contentType: 'image/png' },
    });
    const { key } = sign.json();

    const tampered = await app.inject({
      method: 'PUT',
      url: `/uploads/${key}?token=deadbeef&expires=9999999999999&contentType=image%2Fpng`,
      headers: { 'content-type': 'image/png' },
      payload: Buffer.from('x'),
    });
    expect(tampered.statusCode).toBe(403);

    const expired = await app.inject({
      method: 'PUT',
      url: `/uploads/${key}?token=whatever&expires=1000000000000&contentType=image%2Fpng`,
      headers: { 'content-type': 'image/png' },
      payload: Buffer.from('x'),
    });
    expect(expired.statusCode).toBe(403);
  });

  it('gates a contractor-doc (private/) key behind its token; a public/ key needs none', async () => {
    const sign = await app.inject({
      method: 'POST',
      url: '/admin/uploads/sign',
      headers: { cookie: adminCookie },
      payload: { purpose: 'contractor-docs', filename: 'price-list.pdf', contentType: 'application/pdf' },
    });
    const { key, uploadUrl, publicUrl } = sign.json();
    expect(publicUrl).toBeNull(); // contractor-docs never get a stable public URL
    expect(key.startsWith('private/')).toBe(true);

    const uploadPath = uploadUrl.replace('http://localhost:3000', '');
    await app.inject({
      method: 'PUT',
      url: uploadPath,
      headers: { 'content-type': 'application/pdf' },
      payload: Buffer.from('%PDF-1.4 fake'),
    });

    const noToken = await app.inject({ method: 'GET', url: `/uploads/${key}` });
    expect(noToken.statusCode).toBe(403);

    // The GET /contractor-docs metadata endpoint re-signs a fresh URL from
    // fileKey on every read — that's the intended path to this file.
    const doc = await prisma.contractorDoc.create({
      data: { key: 'test-doc', name: 'Test Doc', fileKey: key },
    });
    const publicList = await app.inject({ method: 'GET', url: '/contractor-docs' });
    const listed = publicList.json().find((d: { key: string }) => d.key === doc.key);
    const signedPath = listed.fileUrl.replace('http://localhost:3000', '');

    const withToken = await app.inject({ method: 'GET', url: signedPath });
    expect(withToken.statusCode).toBe(200);
    expect(withToken.payload).toBe('%PDF-1.4 fake');
  });
});
