import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '../../src/utils/index';

describe('successResponse', () => {
  it('returns success: true with data', () => {
    const result = successResponse({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  it('does not include meta when not provided', () => {
    const result = successResponse('hello');
    expect(result.success).toBe(true);
    expect('meta' in result).toBe(false);
  });

  it('includes meta when provided', () => {
    const meta = { page: 1, limit: 20, total: 100, totalPages: 5 };
    const result = successResponse(['item'], meta);
    expect(result.success).toBe(true);
    expect(result.meta).toEqual(meta);
  });
});

describe('errorResponse', () => {
  it('returns success: false with code and message', () => {
    const result = errorResponse('NOT_FOUND', 'Resource not found');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('Resource not found');
  });

  it('does not include details when not provided', () => {
    const result = errorResponse('ERR', 'msg');
    expect('details' in result.error).toBe(false);
  });

  it('includes details when provided', () => {
    const result = errorResponse('VALIDATION', 'Invalid input', { field: 'email' });
    expect(result.error.details).toEqual({ field: 'email' });
  });
});
