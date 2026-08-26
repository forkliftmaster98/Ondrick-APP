import type { SafeUser } from './safe-user.js';

// Trade price = round(list * (1 - discountPct/100), 2), per BACKEND_SPEC.md.
export function applyTradeDiscount(listPrice: number, discountPct: number): number {
  return Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
}

export function isVerifiedContractor(
  user: Pick<SafeUser, 'role' | 'contractorVerifiedAt'> | null | undefined,
): boolean {
  return Boolean(user) && user!.role === 'CONTRACTOR' && user!.contractorVerifiedAt !== null;
}
