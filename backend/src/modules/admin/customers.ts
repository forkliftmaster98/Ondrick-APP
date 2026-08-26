import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireAdmin } from '../../middleware/auth.js';

// The prototype's admin customer list was a separately-maintained localStorage
// array, manually deduped by email-falling-back-to-phone (see BACKEND_SPEC.md
// migration table). That dedupe is now structural — users.email is unique at
// the DB level — so this is just the user roster, staff-facing fields only.
// EMPLOYEE accounts are excluded; they aren't leads.
export async function adminCustomersRoutes(app: FastifyInstance) {
  app.get('/admin/customers', { preHandler: requireAdmin }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      where: { role: { in: ['CUSTOMER', 'CONTRACTOR'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        contractorVerifiedAt: true,
        createdAt: true,
        _count: { select: { quotes: true } },
      },
    });

    return reply.send({
      customers: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        role: u.role,
        contractorVerifiedAt: u.contractorVerifiedAt,
        createdAt: u.createdAt,
        quoteCount: u._count.quotes,
      })),
    });
  });
}
