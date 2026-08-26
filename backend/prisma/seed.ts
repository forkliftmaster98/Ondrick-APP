import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seed-data.js';

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(() => {
    console.log('Seed complete.');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
