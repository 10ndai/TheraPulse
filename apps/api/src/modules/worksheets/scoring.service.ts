import { Injectable } from '@nestjs/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoringRange {
  min: number;
  max: number;
  severity: string;
}

export interface ScoringConfig {
  maxScore: number;
  ranges: ScoringRange[];
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  content?: string;
  options?: Array<{ value: string; label: string }>;
  scoringKey?: string;
}

export interface FormSchema {
  version: number;
  fields: FormField[];
}

export interface ScoreResult {
  totalScore: number;
  severity: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Computes standardised assessment scores (PHQ-9, GAD-7, etc.) from
 * submitted worksheet responses using the template's `scoringConfig`.
 *
 * Scoring algorithm:
 *  1. Identify all fields that have a `scoringKey` property.
 *  2. For each such field, look up the response by `scoringKey`.
 *  3. Parse the response as a number (default 0 for missing/non-numeric).
 *  4. Sum all parsed values to get `totalScore`.
 *  5. Look up severity by finding the first range where min <= totalScore <= max.
 */
@Injectable()
export class ScoringService {
  /**
   * @param config - The template's `scoringConfig` JSON. Pass null/undefined if
   *   the template has no scoring (e.g., journaling worksheets).
   * @param schema - The template's `formSchema`.
   * @param responses - The client's submitted responses keyed by `scoringKey`
   *   (as stored after decryption and JSON.parse).
   * @returns ScoreResult or null when the template has no scoring config.
   */
  score(
    config: ScoringConfig | null | undefined,
    schema: FormSchema,
    responses: Record<string, unknown>,
  ): ScoreResult | null {
    if (!config) return null;

    const totalScore = this.computeTotal(schema.fields, responses);
    const severity = this.resolveSeverity(totalScore, config.ranges);

    return { totalScore, severity };
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private computeTotal(fields: FormField[], responses: Record<string, unknown>): number {
    let total = 0;
    for (const field of fields) {
      if (!field.scoringKey) continue;
      const raw = responses[field.scoringKey];
      const value = this.parseScore(raw);
      total += value;
    }
    return total;
  }

  private parseScore(raw: unknown): number {
    if (raw === null || raw === undefined) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private resolveSeverity(totalScore: number, ranges: ScoringRange[]): string {
    for (const range of ranges) {
      if (totalScore >= range.min && totalScore <= range.max) {
        return range.severity;
      }
    }
    // Fallback: if score exceeds all ranges (shouldn't happen in valid data),
    // return the last range's severity.
    return ranges[ranges.length - 1]?.severity ?? 'unknown';
  }
}
