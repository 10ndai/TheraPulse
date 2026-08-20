import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
});

describe('ZodValidationPipe', () => {
  it('passes through valid data, returning parsed output', () => {
    const pipe = new ZodValidationPipe(testSchema);
    const result = pipe.transform({ name: 'Alice', age: 30 });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws BadRequestException for invalid data', () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform({ name: '', age: -1 })).toThrow(BadRequestException);
  });

  it('throws BadRequestException for missing required fields', () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('error response has success:false and VALIDATION_ERROR code', () => {
    const pipe = new ZodValidationPipe(testSchema);
    try {
      pipe.transform({ name: '', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
      expect(body['success']).toBe(false);
      expect((body['error'] as Record<string, unknown>)['code']).toBe('VALIDATION_ERROR');
    }
  });

  it('error response includes validation details array', () => {
    const pipe = new ZodValidationPipe(testSchema);
    try {
      pipe.transform({ name: '', age: -1 });
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(Array.isArray(error['details'])).toBe(true);
    }
  });

  it('coerces data via schema transformations', () => {
    const coercingSchema = z.object({
      count: z.coerce.number(),
    });
    const pipe = new ZodValidationPipe(coercingSchema);
    const result = pipe.transform({ count: '42' });
    expect((result as { count: number }).count).toBe(42);
  });

  it('throws BadRequestException for non-object input when schema expects object', () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });
});
