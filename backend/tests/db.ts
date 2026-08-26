import { prisma } from '../src/db/prisma.js';
import { seedDatabase } from '../prisma/seed-data.js';

// TRUNCATE ... CASCADE ignores each table's normal ON DELETE behavior and
// computes the full dependency closure itself, so listing every table once
// (order doesn't matter) is enough — no need to hand-order by FK direction.
const TABLES = [
  'users',
  'sessions',
  'password_reset_tokens',
  'admin_emails',
  'contractor_codes',
  'material_categories',
  'material_products',
  'dumping_items',
  'dumping_restrictions',
  'tools',
  'clearance_items',
  'events',
  'team_members',
  'contractor_docs',
  'carts',
  'cart_items',
  'quotes',
  'quote_items',
  'reviews',
  'settings',
];

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );
  await seedDatabase(prisma);
}
