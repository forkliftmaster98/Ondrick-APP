import { Prisma } from '@prisma/client';

// Prisma throws P2025 when update/delete targets a row that doesn't exist —
// admin routes translate that into a plain 404 instead of a 500.
export function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}
