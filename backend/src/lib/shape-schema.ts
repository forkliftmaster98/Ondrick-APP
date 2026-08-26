import { z } from 'zod';
import type { ShapeInput } from './calculator.js';

export const shapeSchema: z.ZodType<ShapeInput> = z.discriminatedUnion('shape', [
  z.object({ shape: z.literal('rect'), lengthFt: z.number().positive(), widthFt: z.number().positive() }),
  z.object({ shape: z.literal('circle'), diameterFt: z.number().positive() }),
  z.object({ shape: z.literal('manual'), sqft: z.number().positive() }),
]);
