import type { User } from '@prisma/client';

// Strips passwordHash (and internal FK columns) before a user record ever
// reaches a response body.
export function toSafeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    driverNotes: user.driverNotes,
    role: user.role,
    isAdmin: user.isAdmin,
    contractorVerifiedAt: user.contractorVerifiedAt,
    notifOrderUpdates: user.notifOrderUpdates,
    notifPromos: user.notifPromos,
    prefLargeText: user.prefLargeText,
    prefReduceMotion: user.prefReduceMotion,
    createdAt: user.createdAt,
  };
}

export type SafeUser = ReturnType<typeof toSafeUser>;
