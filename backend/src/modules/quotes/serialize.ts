import type { Quote, QuoteItem } from '@prisma/client';
import { num } from '../../lib/decimal.js';

type QuoteWithItems = Quote & { items: QuoteItem[] };

export function serializeQuote(quote: QuoteWithItems) {
  return {
    id: quote.id,
    submittedAt: quote.submittedAt,
    fulfillment: quote.fulfillment,
    total: num(quote.total) as number,
    contactName: quote.contactName,
    phone: quote.phone,
    email: quote.email,
    address: quote.address,
    driverNotes: quote.driverNotes,
    status: quote.status,
    discountPct: num(quote.discountPct),
    discountSourceLabel: quote.discountSourceLabel,
    items: quote.items.map((item) => ({
      id: item.id,
      categoryName: item.categoryName,
      productName: item.productName,
      shapeSummary: item.shapeSummary,
      depthIn: num(item.depthIn) as number,
      wastePct: num(item.wastePct) as number,
      yards: num(item.yards) as number,
      bags: item.bags,
      weightLb: item.weightLb,
      cost: num(item.cost) as number,
    })),
  };
}

export type SerializedQuote = ReturnType<typeof serializeQuote>;
