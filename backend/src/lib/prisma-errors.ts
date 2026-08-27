import { Prisma } from '@prisma/client';

// Prisma throws P2025 when update/delete targets a row that doesn't exist —
// admin routes translate that into a plain 404 instead of a 500.
export function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

// Prisma throws P2002 on a unique-constraint violation (e.g. a duplicate
// email/key created between a route's own existence check and its create
// call) — routes translate that into the same 409 the check would have
// produced, instead of a 500.
export function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
