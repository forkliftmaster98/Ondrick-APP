import { env } from '../../config/env.js';
import { LocalDiskAdapter } from './local.js';
import { S3StorageAdapter } from './s3.js';
import type { StorageAdapter } from './types.js';

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!cached) {
    cached = env.STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalDiskAdapter();
  }
  return cached;
}

export * from './types.js';
