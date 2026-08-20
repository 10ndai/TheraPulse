'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalTherapists: number;
  totalClients: number;
  totalWorksheetSubmissions: number;
  totalSessionNotes: number;
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

export default function AdminPlatformDashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/dashboard/admin');
      const body = (await res.json()) as {
        success: boolean;
        data: AdminStats;
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
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-foreground)]">Platform Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Therapists" value={stats.totalTherapists} />
        <StatCard label="Clients" value={stats.totalClients} />
        <StatCard label="Worksheet Submissions" value={stats.totalWorksheetSubmissions} />
        <StatCard label="Session Notes" value={stats.totalSessionNotes} />
      </div>
    </div>
  );
}
