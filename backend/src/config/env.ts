import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  // Staff inbox for new-quote notifications. No transactional email provider
  // is wired up yet (see lib/email.ts) so this only matters once one is.
  YARD_NOTIFICATION_EMAIL: z.string().email().default('quotes@ondrick.example'),
});

export const env = envSchema.parse(process.env);
