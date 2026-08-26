import type { Decimal } from '@prisma/client/runtime/library';

// Prisma's Decimal doesn't serialize to a plain number over JSON on its own;
// route handlers convert explicitly at the response boundary so clients get
// real numbers, not decimal.js objects/strings.
export function num(value: Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}
