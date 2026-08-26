import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';
import { hashPassword } from '../../lib/password.js';
import { requireAdmin } from '../../middleware/auth.js';

const patchSchema = z.object({
  tradeDiscountPct: z.number().min(0).max(100).optional(),
  // Omit to leave the PIN as-is; null clears it (disables the convenience
  // gate); a string sets/replaces it. Never returned back in a response —
  // only whether one is set.
  adminPin: z.string().trim().min(4).max(32).nullable().optional(),
  // Full replace of the allowlist, matching how the small admin_emails
  // table is meant to be edited (there's no reason to PATCH one entry at
  // a time for a handful of addresses).
  adminEmails: z.array(z.string().trim().toLowerCase().email()).optional(),
});

async function serializeSettings() {
  const [settings, adminEmails] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.adminEmail.findMany({ orderBy: { email: 'asc' } }),
  ]);
  return {
    tradeDiscountPct: num(settings.tradeDiscountPct) as number,
    hasAdminPin: settings.adminPinHash !== null,
    adminEmails: adminEmails.map((e) => e.email),
  };
}

// contractor_code lives in its own table now (see admin/contractor-codes.ts)
// rather than a single settings.contractor_code — this covers the rest of
// BACKEND_SPEC.md's settings block: trade discount, admin PIN, admin
// email allowlist.
export async function adminSettingsRoutes(app: FastifyInstance) {
  app.get('/admin/settings', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await serializeSettings());
  });

  app.patch('/admin/settings', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { tradeDiscountPct, adminPin, adminEmails } = parsed.data;

    if (tradeDiscountPct !== undefined || adminPin !== undefined) {
      const adminPinHash = adminPin === undefined ? undefined : adminPin === null ? null : await hashPassword(adminPin);
      await prisma.settings.update({
        where: { id: 1 },
        data: {
          ...(tradeDiscountPct !== undefined ? { tradeDiscountPct } : {}),
          ...(adminPinHash !== undefined ? { adminPinHash } : {}),
        },
      });
    }

    if (adminEmails !== undefined) {
      await prisma.$transaction([
        prisma.adminEmail.deleteMany({}),
        ...(adminEmails.length > 0
          ? [prisma.adminEmail.createMany({ data: adminEmails.map((email) => ({ email })), skipDuplicates: true })]
          : []),
      ]);
    }

    return reply.send(await serializeSettings());
  });
}
