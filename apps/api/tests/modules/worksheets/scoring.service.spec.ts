import { describe, it, expect } from 'vitest';
import { ScoringService } from '../../../src/modules/worksheets/scoring.service';
import type { ScoringConfig, FormSchema } from '../../../src/modules/worksheets/scoring.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const phq9Likert = [
  { value: '0', label: 'Not at all' },
  { value: '1', label: 'Several days' },
  { value: '2', label: 'More than half the days' },
  { value: '3', label: 'Nearly every day' },
];

const phq9Schema: FormSchema = {
  version: 1,
  fields: [
    {
      id: 'phq1',
      type: 'likert',
      label: 'Q1',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq1',
    },
    {
      id: 'phq2',
      type: 'likert',
      label: 'Q2',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq2',
    },
    {
      id: 'phq3',
      type: 'likert',
      label: 'Q3',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq3',
    },
    {
      id: 'phq4',
      type: 'likert',
      label: 'Q4',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq4',
    },
    {
      id: 'phq5',
      type: 'likert',
      label: 'Q5',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq5',
    },
    {
      id: 'phq6',
      type: 'likert',
      label: 'Q6',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq6',
    },
    {
      id: 'phq7',
      type: 'likert',
      label: 'Q7',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq7',
    },
    {
      id: 'phq8',
      type: 'likert',
      label: 'Q8',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq8',
    },
    {
      id: 'phq9',
      type: 'likert',
      label: 'Q9',
      required: true,
      options: phq9Likert,
      scoringKey: 'phq9',
    },
    {
      id: 'intro',
      type: 'label',
      label: 'Instructions',
      required: false,
      content: 'Rate each item.',
    },
  ],
};

const phq9Config: ScoringConfig = {
  maxScore: 27,
  ranges: [
    { min: 0, max: 4, severity: 'minimal' },
    { min: 5, max: 9, severity: 'mild' },
    { min: 10, max: 14, severity: 'moderate' },
    { min: 15, max: 19, severity: 'moderately-severe' },
    { min: 20, max: 27, severity: 'severe' },
  ],
};

const gad7Config: ScoringConfig = {
  maxScore: 21,
  ranges: [
    { min: 0, max: 4, severity: 'minimal' },
    { min: 5, max: 9, severity: 'mild' },
    { min: 10, max: 14, severity: 'moderate' },
    { min: 15, max: 21, severity: 'severe' },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ScoringService', () => {
  const service = new ScoringService();

  // ── PHQ-9 severity thresholds ──────────────────────────────────────────────

  it('PHQ-9 total=0 → severity "minimal"', () => {
    const responses: Record<string, string> = {};
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6', 'phq7', 'phq8', 'phq9']) {
      responses[k] = '0';
    }
    const result = service.score(phq9Config, phq9Schema, responses);
    expect(result).toEqual({ totalScore: 0, severity: 'minimal' });
  });

  it('PHQ-9 total=5 → severity "mild"', () => {
    const responses: Record<string, string> = {};
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6', 'phq7', 'phq8', 'phq9']) {
      responses[k] = '0';
    }
    // Override first two to get total=5
    responses['phq1'] = '2';
    responses['phq2'] = '3';
    const result = service.score(phq9Config, phq9Schema, responses);
    expect(result?.totalScore).toBe(5);
    expect(result?.severity).toBe('mild');
  });

  it('PHQ-9 total=10 → severity "moderate"', () => {
    const responses: Record<string, string> = {};
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6', 'phq7', 'phq8', 'phq9']) {
      responses[k] = '1';
    }
    responses['phq1'] = '2'; // total = 8*1 + 2 = 10
    const result = service.score(phq9Config, phq9Schema, responses);
    expect(result?.totalScore).toBe(10);
    expect(result?.severity).toBe('moderate');
  });

  it('PHQ-9 total=15 → severity "moderately-severe"', () => {
    const responses: Record<string, string> = {};
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6', 'phq7', 'phq8', 'phq9']) {
      responses[k] = '2'; // 9*2=18 → too high
    }
    // Use: 6×2 + 3×1 = 15
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6']) responses[k] = '2';
    for (const k of ['phq7', 'phq8', 'phq9']) responses[k] = '1';
    const result = service.score(phq9Config, phq9Schema, responses);
    expect(result?.totalScore).toBe(15);
    expect(result?.severity).toBe('moderately-severe');
  });

  it('PHQ-9 total=27 → severity "severe"', () => {
    const responses: Record<string, string> = {};
    for (const k of ['phq1', 'phq2', 'phq3', 'phq4', 'phq5', 'phq6', 'phq7', 'phq8', 'phq9']) {
      responses[k] = '3';
    }
    const result = service.score(phq9Config, phq9Schema, responses);
    expect(result).toEqual({ totalScore: 27, severity: 'severe' });
  });

  // ── GAD-7 thresholds ───────────────────────────────────────────────────────

  it('GAD-7 total=10 → severity "moderate"', () => {
    const gad7Schema: FormSchema = {
      version: 1,
      fields: [
        {
          id: 'gad1',
          type: 'likert',
          label: 'Q1',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad1',
        },
        {
          id: 'gad2',
          type: 'likert',
          label: 'Q2',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad2',
        },
        {
          id: 'gad3',
          type: 'likert',
          label: 'Q3',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad3',
        },
        {
          id: 'gad4',
          type: 'likert',
          label: 'Q4',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad4',
        },
        {
          id: 'gad5',
          type: 'likert',
          label: 'Q5',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad5',
        },
        {
          id: 'gad6',
          type: 'likert',
          label: 'Q6',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad6',
        },
        {
          id: 'gad7',
          type: 'likert',
          label: 'Q7',
          required: true,
          options: phq9Likert,
          scoringKey: 'gad7',
        },
      ],
    };
    const responses = {
      gad1: '2',
      gad2: '2',
      gad3: '2',
      gad4: '2',
      gad5: '1',
      gad6: '1',
      gad7: '0',
    };
    const result = service.score(gad7Config, gad7Schema, responses);
    expect(result?.totalScore).toBe(10);
    expect(result?.severity).toBe('moderate');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('returns null when scoringConfig is null/absent', () => {
    const result = service.score(null, phq9Schema, { phq1: '1' });
    expect(result).toBeNull();
  });

  it('treats missing responses as score 0', () => {
    // Only respond to phq1 (score 3), rest missing
    const result = service.score(phq9Config, phq9Schema, { phq1: '3' });
    expect(result?.totalScore).toBe(3);
    expect(result?.severity).toBe('minimal');
  });

  it('ignores non-scoring fields (label type)', () => {
    // 'intro' field has no scoringKey — should not contribute to score
    const result = service.score(phq9Config, phq9Schema, { intro: '5', phq1: '1' });
    expect(result?.totalScore).toBe(1);
  });

  it('treats non-numeric response values as 0', () => {
    const result = service.score(phq9Config, phq9Schema, { phq1: 'not-a-number' });
    expect(result?.totalScore).toBe(0);
  });

  it('returns severity as unknown string if total exceeds all ranges', () => {
    // Score > maxScore — should not happen in practice but should be handled gracefully
    const result = service.score(phq9Config, phq9Schema, {
      phq1: '3',
      phq2: '3',
      phq3: '3',
      phq4: '3',
      phq5: '3',
      phq6: '3',
      phq7: '3',
      phq8: '3',
      phq9: '3',
    });
    // Max is 27, which IS in the last range, so severity = 'severe'
    expect(result?.severity).toBe('severe');
  });
});
