'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionNote {
  id: string;
  therapistId: string;
  clientId: string;
  sessionDate: string;
  sessionType: string;
  assessment: string | null;
  plan: string | null;
  status: string;
  version: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionSummaryPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [note, setNote] = useState<SessionNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/session-notes/${id}`);
      const body = (await res.json()) as {
        success: boolean;
        data: SessionNote;
        error?: { message: string };
      };
      if (body.success) {
        setNote(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load session summary.');
      }
    } catch {
      setLoadError('Failed to load session summary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading session summary…" />
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Session Summary</h1>
        <Button type="button" variant="outline" onClick={() => router.push('/session-notes')}>
          Back
        </Button>
      </div>

      {/* Session meta */}
      <div className="mb-6 flex gap-4 text-sm text-[var(--color-muted)]">
        <span>{note?.sessionDate}</span>
        <span className="capitalize">{note?.sessionType}</span>
      </div>

      {/* Therapist notes for you (assessment) */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">
          Therapist Notes for You
        </h2>
        {note?.assessment ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
            {note.assessment}
          </p>
        ) : (
          <p className="text-sm italic text-[var(--color-muted)]">(nothing shared)</p>
        )}
      </section>

      {/* What to work on next (plan) */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">
          What to Work on Next
        </h2>
        {note?.plan ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
            {note.plan}
          </p>
        ) : (
          <p className="text-sm italic text-[var(--color-muted)]">(nothing shared)</p>
        )}
      </section>
    </div>
  );
}
