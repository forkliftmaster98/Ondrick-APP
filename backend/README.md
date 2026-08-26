# Ondrick backend

Node/TypeScript/Fastify/Prisma/PostgreSQL API for the Ondrick Material Supply App.
See `../BACKEND_SPEC.md` (repo root, if present in your checkout) for the data model and API rationale.

## Prerequisites

- Node 20+
- A local PostgreSQL 16 instance

## First-time setup

```bash
npm install
cp .env.example .env        # edit DATABASE_URL / SESSION_SECRET as needed
npx prisma migrate deploy   # apply migrations
npm run prisma:seed         # populate the real catalog/dumping/etc. seed data
npm run dev                 # http://localhost:3000
```

`GET /health` confirms both the server and DB connection are up.

## Environment variables

All are read/validated in `src/config/env.ts`. Notable ones beyond `DATABASE_URL`/`PORT`/`SESSION_SECRET`:

- `YARD_NOTIFICATION_EMAIL` — staff inbox for new-quote alerts. No transactional email provider is wired up yet (`src/lib/email.ts` logs instead of sending) — swap that file's body for a real provider once one is chosen.
- `STORAGE_DRIVER` (`local` default, or `s3`) — asset storage for material/team/clearance/tool images and contractor docs. `local` needs no configuration and serves uploads from this same server (`.data/uploads/`, gitignored) — it's the dev/test default. Set `s3` plus `S3_BUCKET`/`S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (and optionally `S3_ENDPOINT` for R2/MinIO, `S3_PUBLIC_URL_BASE` for a CDN in front of the bucket) for production.

## Tests

Integration tests (`tests/*.test.ts`) run the real Fastify app via `app.inject()` against a dedicated test database, truncated and reseeded before every test. The calculator's unit tests (`src/lib/calculator.test.ts`) need no database.

One-time setup (separate from the dev database above):

```bash
sudo -u postgres createdb -O ondrick ondrick_test   # or your Postgres setup's equivalent
```

Then:

```bash
npm test
```

`vitest.config.ts`'s `globalSetup` applies pending migrations to the test DB automatically on every run; it does not create the database itself. Override the connection with `TEST_DATABASE_URL` if your setup differs from the default (`postgresql://ondrick:ondrick@localhost:5432/ondrick_test?schema=public`).

## Project layout

```
prisma/           schema, migrations, seed data (seed-data.ts is shared with the test suite)
src/
  app.ts          Fastify instance + route registration
  config/         env validation
  db/             Prisma client singleton
  lib/            calculator, pricing, storage adapters, session/password helpers, etc.
  middleware/     requireAuth / optionalAuth / requireAdmin
  modules/        one folder per resource (routes.ts, plus serialize.ts where relevant)
tests/            integration tests + test harness (db reset, test-app helper)
```
