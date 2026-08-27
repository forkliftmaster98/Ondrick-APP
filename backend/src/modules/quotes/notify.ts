import type { SerializedQuote } from './serialize.js';

export function buildStaffEmailBody(quote: SerializedQuote): string {
  const itemLines = quote.items.map(
    (item) =>
      `- ${item.productName} (${item.categoryName}): ${item.shapeSummary}, ${item.depthIn}" depth, ${item.yards} yd, $${item.cost.toFixed(2)}`,
  );
  // !== null, not truthiness — a legitimate 0% discount (e.g. trade
  // discount temporarily suspended) still has discountSourceLabel worth
  // recording, and a falsy check would silently drop that line.
  const discountLine =
    quote.discountPct !== null
      ? `\nDiscount applied: ${quote.discountPct}% off — ${quote.discountSourceLabel ?? 'contractor code'}`
      : '';

  return [
    `New quote request from ${quote.contactName} (${quote.email}, ${quote.phone})`,
    `Fulfillment: ${quote.fulfillment}`,
    `Address: ${quote.address}`,
    quote.driverNotes ? `Driver notes: ${quote.driverNotes}` : '',
    '',
    'Items:',
    ...itemLines,
    '',
    `Total: $${quote.total.toFixed(2)}${discountLine}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildCustomerEmailBody(quote: SerializedQuote): string {
  const itemLines = quote.items.map((item) => `- ${item.productName}: ${item.shapeSummary}, $${item.cost.toFixed(2)}`);

  return [
    `Hi ${quote.contactName}, thanks for your estimate request!`,
    'Our team will follow up shortly to confirm details.',
    '',
    'Items:',
    ...itemLines,
    '',
    `Estimated total: $${quote.total.toFixed(2)}`,
  ].join('\n');
}
