'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreResult {
  totalScore: number;
  severity: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  clientId: string;
  responses: string;
  score: ScoreResult | null;
  finalizedAt: string | null;
  integrityHash: string;
  createdAt: string;
  assignment: {
    template: { id: string; title: string; type: string };
  };
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface ScorePoint {
  date: string;
  score: number;
}

function ScoreTrend({ points }: { points: ScorePoint[] }): React.JSX.Element {
  if (points.length < 2) {
    const [only] = points;
    return (
      <div data-testid="score-trend" className="text-sm text-[var(--color-muted)]">
        {only ? `Score: ${only.score}` : 'No scores yet'}
      </div>
    );
  }

  const width = 200;
  const height = 40;
  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const scores = points.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const pathData = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * innerW;
      const y = padding + innerH - ((p.score - minScore) / range) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div data-testid="score-trend" aria-label="Score trend sparkline">
      <svg width={width} height={height} aria-hidden="true">
        <polyline
          points={points
            .map((p, i) => {
              const x = padding + (i / (points.length - 1)) * innerW;
              const y = padding + innerH - ((p.score - minScore) / range) * innerH;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
        />
        <path d={pathData} />
      </svg>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SubmissionHistoryPage(): React.JSX.Element {
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/worksheet-submissions?limit=50&finalized=true');
      const body = (await res.json()) as {
        success: boolean;
        data: Submission[];
        error?: { message: string };
      };
      if (body.success) {
        setSubmissions(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load submission history.');
      }
    } catch {
      setLoadError('Failed to load submission history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading history…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-2xl py-16 text-center text-[var(--color-destructive)]"
      >
        {loadError}
      </p>
    );
  }

  // Build score trend points (sorted oldest → newest)
  const scorePoints: ScorePoint[] = submissions
    .filter((s) => s.score !== null && s.finalizedAt)
    .sort((a, b) => new Date(a.finalizedAt!).getTime() - new Date(b.finalizedAt!).getTime())
    .map((s) => ({ date: s.finalizedAt!, score: s.score!.totalScore }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-[var(--color-foreground)]">Submission History</h1>

      {scorePoints.length > 0 && (
        <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-muted)]">Score Trend</p>
          <ScoreTrend points={scorePoints} />
        </div>
      )}

      {submissions.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-muted)]">No submissions yet.</p>
      ) : (
        <ol className="space-y-4">
          {submissions.map((sub) => (
            <li
              key={sub.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-[var(--color-foreground)]">
                    {sub.assignment.template.title}
                  </p>
                  {sub.finalizedAt && (
                    <p className="text-xs text-[var(--color-muted)]">
                      {new Date(sub.finalizedAt).toLocaleDateString()}
                    </p>
                  )}
                  {sub.score && (
                    <p className="mt-1 text-sm text-[var(--color-foreground)]">
                      Score: <strong>{sub.score.totalScore}</strong>{' '}
                      <span className="capitalize text-[var(--color-muted)]">
                        ({sub.score.severity})
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/worksheet-submissions/${sub.id}/review`)}
                  aria-label={`Review submission ${sub.id}`}
                >
                  Review
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
