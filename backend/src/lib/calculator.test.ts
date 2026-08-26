import { describe, expect, it } from 'vitest';
import { calculate, shapeSummary } from './calculator.js';

describe('calculate', () => {
  it('matches the prototype for a rectangle bed (mulch, 3in depth, 10% waste)', () => {
    // 12' x 20' = 240 sqft, depth 3in, waste 10%, mulch $44/yd, 500 lb/yd
    const result = calculate({
      shapeInput: { shape: 'rect', lengthFt: 12, widthFt: 20 },
      depthIn: 3,
      fallbackDepthIn: 3,
      wastePct: 10,
      pricePerYard: 44,
      weightPerYardLb: 500,
    });
    // yardsNet = 240*3/324 = 2.222222..., yards = *1.1 = 2.4444444...
    expect(result.sqft).toBe(240);
    expect(result.yards).toBe(2.44);
    expect(result.bags).toBe(Math.ceil(2.4444444444444446 * 13.5)); // 33
    expect(result.bags).toBe(33);
    expect(result.weightLb).toBe(Math.round(2.4444444444444446 * 500)); // 1222
    expect(result.weightLb).toBe(1222);
    expect(result.cost).toBe(Math.round(2.4444444444444446 * 44 * 100) / 100); // 107.56
    expect(result.cost).toBe(107.56);
    expect(result.shapeSummary).toBe("12' x 20'");
  });

  it('computes circle area via PI * (d/2)^2', () => {
    const result = calculate({
      shapeInput: { shape: 'circle', diameterFt: 8 },
      depthIn: 4,
      fallbackDepthIn: 4,
      wastePct: 0,
      pricePerYard: 32,
      weightPerYardLb: 2100,
    });
    const expectedSqft = Math.PI * Math.pow(4, 2); // 50.265...
    expect(result.sqft).toBe(Math.round(expectedSqft));
    expect(result.shapeSummary).toBe("8' dia");
  });

  it('takes manual sqft entry directly', () => {
    const result = calculate({
      shapeInput: { shape: 'manual', sqft: 300 },
      depthIn: 2,
      fallbackDepthIn: 2,
      wastePct: 0,
      pricePerYard: 38,
      weightPerYardLb: 2700,
    });
    expect(result.sqft).toBe(300);
    expect(result.shapeSummary).toBe('300 sq ft');
  });

  it('falls back to the provided depth when none is entered', () => {
    const withZero = calculate({
      shapeInput: { shape: 'manual', sqft: 324 },
      depthIn: 0,
      fallbackDepthIn: 4,
      wastePct: 0,
      pricePerYard: 10,
      weightPerYardLb: 100,
    });
    const withUndefined = calculate({
      shapeInput: { shape: 'manual', sqft: 324 },
      fallbackDepthIn: 4,
      wastePct: 0,
      pricePerYard: 10,
      weightPerYardLb: 100,
    });
    // 324 sqft * 4in / 324 = 4 yards net exactly
    expect(withZero.yards).toBe(4);
    expect(withUndefined.yards).toBe(4);
  });

  it('prefers an explicit user depth over the fallback', () => {
    const result = calculate({
      shapeInput: { shape: 'manual', sqft: 324 },
      depthIn: 8,
      fallbackDepthIn: 4,
      wastePct: 0,
      pricePerYard: 10,
      weightPerYardLb: 100,
    });
    // 324 * 8 / 324 = 8 yards net exactly
    expect(result.yards).toBe(8);
  });

  it('derives bags from raw yards, not the 2-decimal display value', () => {
    // Engineered so raw yards ~2.0007 (bags ceils to 28) but yards rounded to
    // 2dp first is exactly 2.00 (bags would ceil to 27) — proves bags is
    // computed before the display rounding, matching the prototype's order.
    const result = calculate({
      shapeInput: { shape: 'manual', sqft: 648.2268 },
      depthIn: 1,
      fallbackDepthIn: 1,
      wastePct: 0,
      pricePerYard: 1,
      weightPerYardLb: 1,
    });
    expect(result.yards).toBe(2); // display value rounds to 2.00
    expect(result.bags).toBe(28); // but bags used the raw ~2.0007
    expect(Math.ceil(result.yards * 13.5)).toBe(27); // what the wrong order would give
  });

  it('formats shape summaries without a trailing .0', () => {
    expect(shapeSummary({ shape: 'rect', lengthFt: 12, widthFt: 20 })).toBe("12' x 20'");
    expect(shapeSummary({ shape: 'rect', lengthFt: 12.5, widthFt: 20 })).toBe("12.5' x 20'");
    expect(shapeSummary({ shape: 'circle', diameterFt: 8 })).toBe("8' dia");
  });
});
