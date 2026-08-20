'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionEntry {
  id: string;
  worksheetTitle: string;
  finalizedAt: string;
  score: number | null;
}

interface SessionNoteEntry {
  id: string;
  sessionDate: string;
  status: string;
}

type TimelineItemType = 'worksheet' | 'session';

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: string; // ISO string for sorting
  label: string;
  detail: string | null;
}

type FilterType = 'all' | 'worksheet' | 'session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function submissionToItem(s: SubmissionEntry): TimelineItem {
  return {
    id: s.id,
    type: 'worksheet',
    date: s.finalizedAt,
    label: s.worksheetTitle,
    detail: s.score !== null ? `Score: ${s.score}` : null,
  };
}

function noteToItem(n: SessionNoteEntry): TimelineItem {
  return {
    id: n.id,
    type: 'session',
    date: `${n.sessionDate}T00:00:00Z`,
    label: `Session — ${n.sessionDate}`,
    detail: n.status,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientTimelinePage(): React.JSX.Element {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [subRes, noteRes] = await Promise.all([
        fetch('/api/worksheet-submissions/history'),
        fetch('/api/session-notes'),
      ]);
      const subBody = (await subRes.json()) as {
        success: boolean;
        data: SubmissionEntry[];
        error?: { message: string };
      };
      if (!subBody.success) {
        setLoadError(subBody.error?.message ?? 'Failed to load timeline.');
        return;
      }
      const noteBody = (await noteRes.json()) as {
        success: boolean;
        data: SessionNoteEntry[];
        error?: { message: string };
      };
      if (!noteBody.success) {
        setLoadError(noteBody.error?.message ?? 'Failed to load timeline.');
        return;
      }
      const merged: TimelineItem[] = [
        ...subBody.data.map(submissionToItem),
        ...noteBody.data.map(noteToItem),
      ].sort((a, b) => b.date.localeCompare(a.date));
      setItems(merged);
    } catch {
      setLoadError('Failed to load timeline. Please try again.');
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
        <Spinner label="Loading timeline…" />
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

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">My Timeline</h1>

      {/* Filter buttons */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'font-semibold underline' : ''}
        >
          All
        </button>
        <button
          onClick={() => setFilter('worksheet')}
          className={filter === 'worksheet' ? 'font-semibold underline' : ''}
        >
          Worksheets
        </button>
        <button
          onClick={() => setFilter('session')}
          className={filter === 'session' ? 'font-semibold underline' : ''}
        >
          Sessions
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No activity to show yet.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                {item.type === 'worksheet' ? 'Worksheet' : 'Session'}
              </span>
              <p className="font-medium text-[var(--color-foreground)]">{item.label}</p>
              {item.detail !== null && (
                <p className="mt-1 text-sm text-[var(--color-muted)]">{item.detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
