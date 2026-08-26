// No imports on purpose — this must fully execute (setting process.env)
// before any other setup file or test module does a static import that
// would trigger src/config/env.ts to parse process.env prematurely.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ondrick:ondrick@localhost:5432/ondrick_test?schema=public';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-secret-not-for-production-use-000000';
process.env.YARD_NOTIFICATION_EMAIL = process.env.YARD_NOTIFICATION_EMAIL ?? 'quotes@ondrick.example';
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
process.env.STORAGE_DRIVER = 'local';
process.env.LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR ?? '.data/uploads-test';
