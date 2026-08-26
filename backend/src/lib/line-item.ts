import type { MaterialCategory, MaterialProduct } from '@prisma/client';
import { calculate, type ShapeInput } from './calculator.js';
import { num } from './decimal.js';
import { applyTradeDiscount } from './pricing.js';

// Shared by cart-add and direct quote submission — both price a single
// product+shape+depth+waste combination the same way, so this is the one
// place that decides list vs. trade price and calls the calculator.
export interface LineItemInput {
  product: MaterialProduct;
  category: MaterialCategory;
  shapeInput: ShapeInput;
  depthIn?: number | null;
  wastePct: number;
  verified: boolean;
  discountPct: number | null;
}

export interface LineItemResult {
  categoryName: string;
  productName: string;
  shapeSummary: string;
  depthIn: number;
  wastePct: number;
  yards: number;
  bags: number;
  weightLb: number;
  cost: number;
  pricePerYardUsed: number;
}

export function computeLineItem(input: LineItemInput): LineItemResult {
  const listPrice = num(input.product.pricePerYard) as number;
  const pricePerYard =
    input.verified && input.discountPct !== null
      ? applyTradeDiscount(listPrice, input.discountPct)
      : listPrice;
  const fallbackDepthIn = (num(input.product.typicalDepthIn) ?? num(input.category.typicalDepthIn)) as number;

  const result = calculate({
    shapeInput: input.shapeInput,
    depthIn: input.depthIn ?? null,
    fallbackDepthIn,
    wastePct: input.wastePct,
    pricePerYard,
    weightPerYardLb: input.category.weightPerYardLb,
  });

  return {
    categoryName: input.category.name,
    productName: input.product.name,
    shapeSummary: result.shapeSummary,
    depthIn: result.depthIn,
    wastePct: input.wastePct,
    yards: result.yards,
    bags: result.bags,
    weightLb: result.weightLb,
    cost: result.cost,
    pricePerYardUsed: pricePerYard,
  };
}
