import { describe, it, expect } from 'vitest';
import { UserRole } from '../../src/constants/roles';
import { paginationQuerySchema } from '../../src/schemas/pagination.schema';

describe('UserRole constants', () => {
  it('defines ADMIN role', () => {
    expect(UserRole.ADMIN).toBe('ADMIN');
  });

  it('defines THERAPIST role', () => {
    expect(UserRole.THERAPIST).toBe('THERAPIST');
  });

  it('defines CLIENT role', () => {
    expect(UserRole.CLIENT).toBe('CLIENT');
  });
});

describe('paginationQuerySchema', () => {
  it('defaults page to 1 when not provided', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it('defaults limit to 20 when not provided', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects page less than 1', () => {
    const result = paginationQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 100', () => {
    const result = paginationQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('accepts valid page and limit', () => {
    const result = paginationQuerySchema.safeParse({ page: 2, limit: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it('coerces string numbers for page', () => {
    const result = paginationQuerySchema.safeParse({ page: '3', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(10);
    }
  });
});
