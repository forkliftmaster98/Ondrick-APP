import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function teamRoutes(app: FastifyInstance) {
  app.get('/team-members', async () => {
    const members = await prisma.teamMember.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return members.map((member) => ({
      key: member.key,
      name: member.name,
      role: member.role,
      bio: member.bio,
      photoUrl: member.photoUrl,
    }));
  });
}
