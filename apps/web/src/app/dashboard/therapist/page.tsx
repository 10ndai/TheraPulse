'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TherapistStats {
  totalAssignments: number;
  completedAssignments: number;
  totalNotes: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--color-foreground)]">{value}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TherapistDashboardPage(): React.JSX.Element {
  const router = useRouter();

  const [stats, setStats] = useState<TherapistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/dashboard/therapist');
      const body = (await res.json()) as {
        success: boolean;
        data: TherapistStats;
        error?: { message: string };
      };
      if (body.success) {
        setStats(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load dashboard.');
      }
    } catch {
      setLoadError('Failed to load dashboard. Please try again.');
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
        <Spinner label="Loading dashboard…" />
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

  if (!stats) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-4xl py-16 text-center text-[var(--color-destructive)]"
      >
        Dashboard data is unavailable.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-foreground)]">
        Therapist Dashboard
      </h1>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Assignments" value={stats.totalAssignments} />
        <StatCard label="Completed Assignments" value={stats.completedAssignments} />
        <StatCard label="Session Notes" value={stats.totalNotes} />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => router.push('/session-notes/new')}>
            New Session Note
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/session-notes')}>
            View Session Notes
          </Button>
        </div>
      </div>
    </div>
  );
}
