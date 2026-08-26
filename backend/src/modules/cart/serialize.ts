import type { Cart, CartItem } from '@prisma/client';
import { num } from '../../lib/decimal.js';

type CartWithItems = Cart & { items: CartItem[] };

export function serializeCart(cart: CartWithItems) {
  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    categoryName: item.categoryName,
    productName: item.productName,
    shapeSummary: item.shapeSummary,
    depthIn: num(item.depthIn) as number,
    wastePct: num(item.wastePct) as number,
    yards: num(item.yards) as number,
    bags: item.bags,
    weightLb: item.weightLb,
    cost: num(item.cost) as number,
    addedAt: item.addedAt,
  }));

  const total = Math.round(items.reduce((sum, item) => sum + item.cost, 0) * 100) / 100;

  return { id: cart.id, items, total };
}
