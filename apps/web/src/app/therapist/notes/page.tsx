'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteStatus = 'DRAFT' | 'FINALIZED';

interface SessionNote {
  id: string;
  sessionDate: string;
  sessionType: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: NoteStatus;
  version: number;
}

// ─── Note row ─────────────────────────────────────────────────────────────────

function NoteRow({
  note,
  onEdit,
}: {
  note: SessionNote;
  onEdit: (id: string) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <span className="font-medium">{note.sessionDate}</span>
        <span className="capitalize text-[var(--color-muted)]">{note.sessionType}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            note.status === 'FINALIZED'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {note.status === 'FINALIZED' ? 'Finalized' : 'Draft'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3 text-sm">
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
            <div key={field}>
              <span className="font-medium capitalize">{field}: </span>
              <span className="text-[var(--color-muted)]">{note[field] ?? <em>(empty)</em>}</span>
            </div>
          ))}
          {note.status === 'DRAFT' && (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => onEdit(note.id)}
            >
              Edit
            </Button>
          )}
          {note.status === 'FINALIZED' && (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => onEdit(note.id)}
            >
              View
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TherapistNotesPage(): React.JSX.Element {
  const router = useRouter();

  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | NoteStatus>('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/session-notes?limit=100');
      const body = (await res.json()) as {
        success: boolean;
        data: SessionNote[];
        error?: { message: string };
      };
      if (body.success) {
        setNotes(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load session notes.');
      }
    } catch {
      setLoadError('Failed to load session notes. Please try again.');
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
        <Spinner label="Loading session notes…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-3xl py-16 text-center text-[var(--color-destructive)]"
      >
        {loadError}
      </p>
    );
  }

  const filtered = notes
    .filter((n) => !statusFilter || n.status === statusFilter)
    .filter((n) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        n.sessionDate.includes(q) ||
        n.sessionType.toLowerCase().includes(q) ||
        (n.subjective ?? '').toLowerCase().includes(q) ||
        (n.plan ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Session Notes</h1>
        <Button type="button" onClick={() => router.push('/session-notes/new')}>
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search notes"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <label htmlFor="status-filter" className="sr-only">
          Status
        </label>
        <select
          id="status-filter"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | NoteStatus)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="FINALIZED">Finalized</option>
        </select>
      </div>

      {/* Stats */}
      {notes.length > 0 && (
        <div className="mb-4 flex gap-4 text-sm text-[var(--color-muted)]">
          <span>{notes.filter((n) => n.status === 'DRAFT').length} drafts</span>
          <span>{notes.filter((n) => n.status === 'FINALIZED').length} finalized</span>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-muted)]">No session notes found.</p>
      ) : (
        <ol className="space-y-3">
          {filtered.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onEdit={(id) => router.push(`/session-notes/${id}/edit`)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
