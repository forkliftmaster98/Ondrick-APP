import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  // Staff inbox for new-quote notifications. No transactional email provider
  // is wired up yet (see lib/email.ts) so this only matters once one is.
  YARD_NOTIFICATION_EMAIL: z.string().email().default('quotes@ondrick.example'),

  // Asset storage (see lib/storage). 'local' is the zero-config dev/test
  // default — files land on disk and are served by this same server.
  // Switch to 's3' in production (S3-compatible: AWS S3, Cloudflare R2, …).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  LOCAL_UPLOAD_DIR: z.string().default('.data/uploads'),

  // Required only when STORAGE_DRIVER=s3; validated in lib/storage/s3.ts
  // at first use rather than here, so a local-driver dev setup never needs
  // these at all.
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_URL_BASE: z.string().optional(),
});

export const env = envSchema.parse(process.env);
