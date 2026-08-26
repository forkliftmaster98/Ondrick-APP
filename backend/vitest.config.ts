import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/env.setup.ts', './tests/db.setup.ts'],
    // Integration tests share one Postgres database via truncate-and-reseed
    // between tests — running files in parallel would race on that shared
    // state, so keep the whole suite sequential.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
