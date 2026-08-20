import { describe, it, expect } from 'vitest';
import { scrubPhi, PHI_SCRUBBER_PATTERNS } from '../../../src/common/utils/phi-scrubber';

describe('scrubPhi()', () => {
  // ── Email addresses ────────────────────────────────────────────────────────

  it('redacts an email address', () => {
    expect(scrubPhi('User john.doe@example.com logged in')).toBe('User [email] logged in');
  });

  it('redacts multiple email addresses in one string', () => {
    const result = scrubPhi('From a@b.com to c@d.org');
    expect(result).toBe('From [email] to [email]');
  });

  it('redacts email at start of string', () => {
    expect(scrubPhi('foo@bar.com caused an error')).toBe('[email] caused an error');
  });

  // ── Phone numbers ──────────────────────────────────────────────────────────

  it('redacts a 10-digit phone number', () => {
    expect(scrubPhi('Called 0771234567')).toBe('Called [phone]');
  });

  it('redacts a phone number with country code', () => {
    expect(scrubPhi('Contact +263 77 123 4567')).toBe('Contact [phone]');
  });

  it('redacts a phone number with dashes', () => {
    expect(scrubPhi('Phone: 077-123-4567')).toBe('Phone: [phone]');
  });

  // ── Dates of birth ─────────────────────────────────────────────────────────

  it('redacts ISO date (YYYY-MM-DD)', () => {
    expect(scrubPhi('DoB: 1990-05-15')).toBe('DoB: [date]');
  });

  it('redacts slash-separated date (DD/MM/YYYY)', () => {
    expect(scrubPhi('Born on 15/05/1990')).toBe('Born on [date]');
  });

  // ── Non-PHI preserved ──────────────────────────────────────────────────────

  it('leaves non-PHI log messages unchanged', () => {
    const msg = 'POST /api/worksheet-assignments → 201';
    expect(scrubPhi(msg)).toBe(msg);
  });

  it('leaves UUIDs unchanged (they are not PHI)', () => {
    const msg = 'Fetching resource abc12345-0000-0000-0000-000000000001';
    expect(scrubPhi(msg)).toBe(msg);
  });

  it('leaves version numbers unchanged', () => {
    expect(scrubPhi('Node.js v22.0.0')).toBe('Node.js v22.0.0');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('handles empty string', () => {
    expect(scrubPhi('')).toBe('');
  });

  it('handles string with no PHI', () => {
    expect(scrubPhi('Healthy system status')).toBe('Healthy system status');
  });

  it('exports PHI_SCRUBBER_PATTERNS array', () => {
    expect(Array.isArray(PHI_SCRUBBER_PATTERNS)).toBe(true);
    expect(PHI_SCRUBBER_PATTERNS.length).toBeGreaterThan(0);
  });
});
