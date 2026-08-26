import { beforeEach } from 'vitest';
import { resetDatabase } from './db.js';

beforeEach(async () => {
  await resetDatabase();
});
