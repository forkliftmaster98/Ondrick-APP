import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import type { StorageAdapter } from './types.js';

// Production adapter — any S3-compatible store (AWS S3, Cloudflare R2, …).
// Not exercised by this project's local test run (no live bucket in this
// environment); the local driver is the one actually verified end-to-end.
// This file is a thin, standard wrapper around the documented AWS SDK v3
// presigner calls.
export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const { S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
    if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error(
        'STORAGE_DRIVER=s3 requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY to be set',
      );
    }
    this.bucket = S3_BUCKET;
    this.client = new S3Client({
      region: S3_REGION,
      endpoint: env.S3_ENDPOINT, // set for R2/MinIO; omit for AWS S3
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });
  }

  async createUploadTarget(key: string, contentType: string): Promise<{ uploadUrl: string; method: 'PUT' }> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    return { uploadUrl, method: 'PUT' };
  }

  getPublicUrl(key: string): string {
    if (env.S3_PUBLIC_URL_BASE) {
      return `${env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  }

  async getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
