// Ported line-for-line from the prototype's getCalc() (Material Calculator
// App.dc.html). Two subtleties matter for matching it "to the cent":
// 1. bags/weightLb/cost are derived from the RAW (unrounded) yards value,
//    not the 2-decimal display value — only the returned `yards` is rounded.
// 2. sqft is used raw in yardsNet; only the returned `sqft` is rounded for
//    display. Reordering either of these would drift from the prototype on
//    edge cases.

export type ShapeInput =
  | { shape: 'rect'; lengthFt: number; widthFt: number }
  | { shape: 'circle'; diameterFt: number }
  | { shape: 'manual'; sqft: number };

export interface CalculatorParams {
  shapeInput: ShapeInput;
  /** User-entered depth in inches. Falsy/omitted falls back to fallbackDepthIn. */
  depthIn?: number | null;
  /** product.typicalDepthIn ?? category.typicalDepthIn */
  fallbackDepthIn: number;
  wastePct: number;
  /** List price, or the trade price for a verified contractor. */
  pricePerYard: number;
  weightPerYardLb: number;
}

export interface CalculatorResult {
  sqft: number;
  depthIn: number;
  yards: number;
  bags: number;
  weightLb: number;
  cost: number;
  shapeSummary: string;
}

function rawSqft(shapeInput: ShapeInput): number {
  switch (shapeInput.shape) {
    case 'rect':
      return shapeInput.lengthFt * shapeInput.widthFt;
    case 'circle':
      return Math.PI * Math.pow(shapeInput.diameterFt / 2, 2);
    case 'manual':
      return shapeInput.sqft;
  }
}

function formatFeet(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function shapeSummary(shapeInput: ShapeInput): string {
  switch (shapeInput.shape) {
    case 'rect':
      return `${formatFeet(shapeInput.lengthFt)}' x ${formatFeet(shapeInput.widthFt)}'`;
    case 'circle':
      return `${formatFeet(shapeInput.diameterFt)}' dia`;
    case 'manual':
      return `${Math.round(shapeInput.sqft)} sq ft`;
  }
}

export function calculate(params: CalculatorParams): CalculatorResult {
  const sqft = rawSqft(params.shapeInput);
  const depthIn = params.depthIn && params.depthIn > 0 ? params.depthIn : params.fallbackDepthIn;

  const yardsNet = (sqft * depthIn) / 324;
  const yards = yardsNet * (1 + params.wastePct / 100);
  const bags = Math.ceil(yards * 13.5);
  const weightLb = Math.round(yards * params.weightPerYardLb);
  const cost = yards * params.pricePerYard;

  return {
    sqft: Math.round(sqft),
    depthIn,
    yards: Math.round(yards * 100) / 100,
    bags,
    weightLb,
    cost: Math.round(cost * 100) / 100,
    shapeSummary: shapeSummary(params.shapeInput),
  };
}
