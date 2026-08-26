import { execSync } from 'node:child_process';

// Runs once before the whole suite. Requires the target database to
// already exist (one-time local step, e.g. `createdb -O ondrick
// ondrick_test`) — migrate deploy applies schema, it doesn't create the
// database itself.
export async function setup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://ondrick:ondrick@localhost:5432/ondrick_test?schema=public';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
