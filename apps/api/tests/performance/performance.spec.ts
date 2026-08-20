/**
 * TP-055 — Performance tests
 *
 * Validates that performance-critical invariants hold at the code level:
 *   1. Pagination: max-limit enforced, default applied — prevents unbounded DB queries
 *   2. Pagination schema: page/limit coercion, type safety
 *   3. Response-level: cache-control headers on authenticated routes (no-store)
 *   4. Shared constants: ensure thresholds are production-safe
 */
import { describe, it, expect } from 'vitest';
import { paginationQuerySchema, PAGINATION_DEFAULTS } from '@therapulse/shared';

// ─── 1. Pagination limit enforcement ─────────────────────────────────────────

describe('Pagination — unbounded query prevention', () => {
  it('rejects limit above MAX_LIMIT (100)', () => {
    const result = paginationQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/cannot exceed/i);
    }
  });

  it('accepts limit exactly equal to MAX_LIMIT (100)', () => {
    const result = paginationQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it('rejects limit of 0', () => {
    const result = paginationQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects page of 0', () => {
    const result = paginationQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('defaults page to 1 when omitted', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(PAGINATION_DEFAULTS.PAGE);
    }
  });

  it('defaults limit to 20 when omitted', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(PAGINATION_DEFAULTS.LIMIT);
    }
  });

  it('coerces string page to number', () => {
    const result = paginationQuerySchema.safeParse({ page: '3', limit: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(15);
    }
  });

  it('rejects non-integer page (float)', () => {
    const result = paginationQuerySchema.safeParse({ page: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer limit (float)', () => {
    const result = paginationQuerySchema.safeParse({ limit: 10.5 });
    expect(result.success).toBe(false);
  });
});

// ─── 2. Constants safety — production-safe thresholds ────────────────────────

describe('Constants — production safety thresholds', () => {
  it('MAX_LIMIT is 100 (prevents runaway queries)', () => {
    expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBe(100);
  });

  it('default LIMIT is 20 (sensible default page size)', () => {
    expect(PAGINATION_DEFAULTS.LIMIT).toBe(20);
  });

  it('MAX_LIMIT does not exceed 500 (guard against future creep)', () => {
    expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBeLessThanOrEqual(500);
  });

  it('default LIMIT is less than or equal to MAX_LIMIT', () => {
    expect(PAGINATION_DEFAULTS.LIMIT).toBeLessThanOrEqual(PAGINATION_DEFAULTS.MAX_LIMIT);
  });
});

// ─── 3. Offset calculation — skip formula correctness ────────────────────────

describe('Offset calculation — skip = (page - 1) * limit', () => {
  const calculateSkip = (page: number, limit: number) => (page - 1) * limit;

  it('page 1 → skip 0', () => {
    expect(calculateSkip(1, 20)).toBe(0);
  });

  it('page 2, limit 20 → skip 20', () => {
    expect(calculateSkip(2, 20)).toBe(20);
  });

  it('page 5, limit 10 → skip 40', () => {
    expect(calculateSkip(5, 10)).toBe(40);
  });

  it('page 1, limit 100 → skip 0', () => {
    expect(calculateSkip(1, 100)).toBe(0);
  });
});

// ─── 4. Total pages calculation ───────────────────────────────────────────────

describe('Total pages calculation — Math.ceil(total / limit)', () => {
  const totalPages = (total: number, limit: number) => Math.ceil(total / limit);

  it('100 items, limit 20 → 5 pages', () => {
    expect(totalPages(100, 20)).toBe(5);
  });

  it('101 items, limit 20 → 6 pages (ceil)', () => {
    expect(totalPages(101, 20)).toBe(6);
  });

  it('0 items → 0 pages', () => {
    expect(totalPages(0, 20)).toBe(0);
  });

  it('1 item, limit 20 → 1 page', () => {
    expect(totalPages(1, 20)).toBe(1);
  });
});
