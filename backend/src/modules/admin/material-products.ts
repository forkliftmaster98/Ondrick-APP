import type { FastifyInstance } from 'fastify';
import type { MaterialProduct } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { num } from '../../lib/decimal.js';
import { isRecordNotFound } from '../../lib/prisma-errors.js';
import { requireAdmin } from '../../middleware/auth.js';

// Prisma's Decimal serializes to a JSON string, not a number, if sent as-is
// — convert at the response boundary like every other money field in the API.
function serializeProduct(product: MaterialProduct) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    pricePerYard: num(product.pricePerYard) as number,
    typicalDepthIn: num(product.typicalDepthIn),
    imageUrl: product.imageUrl,
    active: product.active,
    sortOrder: product.sortOrder,
  };
}

const createSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  pricePerYard: z.number().nonnegative(),
  typicalDepthIn: z.number().positive().optional(),
  imageUrl: z.string().trim().url().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const updateSchema = createSchema.partial();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminMaterialProductsRoutes(app: FastifyInstance) {
  app.post('/admin/material-products', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const category = await prisma.materialCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) {
      return reply.status(400).send({ error: 'invalid_category' });
    }
    const product = await prisma.materialProduct.create({
      data: { ...parsed.data, active: parsed.data.active ?? true, sortOrder: parsed.data.sortOrder ?? 0 },
    });
    return reply.status(201).send({ product: serializeProduct(product) });
  });

  app.patch('/admin/material-products/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    if (body.data.categoryId) {
      const category = await prisma.materialCategory.findUnique({ where: { id: body.data.categoryId } });
      if (!category) {
        return reply.status(400).send({ error: 'invalid_category' });
      }
    }
    try {
      const product = await prisma.materialProduct.update({ where: { id: params.data.id }, data: body.data });
      return reply.send({ product: serializeProduct(product) });
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });

  app.delete('/admin/material-products/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'invalid_params' });
    }
    try {
      await prisma.materialProduct.delete({ where: { id: params.data.id } });
      return reply.status(204).send();
    } catch (err) {
      if (isRecordNotFound(err)) return reply.status(404).send({ error: 'not_found' });
      throw err;
    }
  });
}
