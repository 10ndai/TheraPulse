'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreTrendPoint {
  date: string;
  score: number;
}

interface ClientProgress {
  totalAssignments: number;
  completedSubmissions: number;
  completionRate: number;
  scoreTrend: ScoreTrendPoint[];
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--color-foreground)]">{value}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientProgressPage(): React.JSX.Element {
  const [progress, setProgress] = useState<ClientProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/dashboard/client');
      const body = (await res.json()) as {
        success: boolean;
        data: ClientProgress;
        error?: { message: string };
      };
      if (body.success) {
        setProgress(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load progress.');
      }
    } catch {
      setLoadError('Failed to load progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading progress…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-4xl py-16 text-center text-[var(--color-destructive)]"
      >
        {loadError}
      </p>
    );
  }

  if (!progress) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-4xl py-16 text-center text-[var(--color-destructive)]"
      >
        Progress data is unavailable.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-foreground)]">My Progress</h1>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Completion Rate" value={`${progress.completionRate}%`} />
        <StatCard label="Total Assignments" value={progress.totalAssignments} />
        <StatCard label="Completed" value={progress.completedSubmissions} />
      </div>

      {/* Score trend chart */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">Score Trend</h2>
        {progress.scoreTrend.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No score data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={progress.scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="var(--color-primary)" dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
