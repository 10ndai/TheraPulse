/**
 * PHI Scrubber — strips Personally Identifiable / Protected Health Information
 * from strings before they are written to logs.
 *
 * Covers the most common accidental PHI leakage patterns:
 *  • Email addresses
 *  • Phone numbers (Zimbabwe +263, international, bare 10-digit)
 *  • Calendar dates (ISO YYYY-MM-DD and DD/MM/YYYY)
 *
 * Usage:
 *   logger.error(scrubPhi(`Failed for user ${email}: ${message}`));
 */

/** Each pattern pair: [regex, replacement] */
export const PHI_SCRUBBER_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]'],
  // International phone numbers: +263 77 123 4567 / +2637712345678 / +1-800-555-1234
  [/\+\d[\d\s-]{6,14}\d/g, '[phone]'],
  // Bare 10-digit phone numbers: 0771234567 / 077-123-4567
  [/\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  // ISO dates: 1990-05-15
  [/\b\d{4}-\d{2}-\d{2}\b/g, '[date]'],
  // Slash dates: 15/05/1990
  [/\b\d{2}\/\d{2}\/\d{4}\b/g, '[date]'],
];

/**
 * Returns a copy of `input` with all recognised PHI patterns replaced.
 * Never throws — if something goes wrong, returns the original string.
 */
export function scrubPhi(input: string): string {
  try {
    return PHI_SCRUBBER_PATTERNS.reduce(
      (s, [pattern, replacement]) => s.replace(pattern, replacement),
      input,
    );
  } catch {
    return input;
  }
}
