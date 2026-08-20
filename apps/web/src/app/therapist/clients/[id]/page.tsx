'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
type NoteStatus = 'DRAFT' | 'FINALIZED';
type TabKey = 'worksheets' | 'notes';

interface WorksheetAssignment {
  id: string;
  status: AssignmentStatus;
  dueDate: string | null;
  createdAt: string;
  template: { id: string; title: string; type: string };
}

interface SessionNote {
  id: string;
  sessionDate: string;
  sessionType: string;
  status: NoteStatus;
  subjective: string | null;
}

const STATUS_BADGE: Record<AssignmentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [activeTab, setActiveTab] = useState<TabKey>('worksheets');
  const [assignments, setAssignments] = useState<WorksheetAssignment[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [assignRes, noteRes] = await Promise.all([
        fetch(`/api/worksheet-assignments?clientId=${clientId}&limit=50`),
        fetch(`/api/session-notes?clientId=${clientId}&limit=50`),
      ]);
      const [assignBody, noteBody] = await Promise.all([
        assignRes.json() as Promise<{
          success: boolean;
          data: WorksheetAssignment[];
          error?: { message: string };
        }>,
        noteRes.json() as Promise<{
          success: boolean;
          data: SessionNote[];
          error?: { message: string };
        }>,
      ]);
      if (!assignBody.success) {
        setLoadError(assignBody.error?.message ?? 'Failed to load data.');
        return;
      }
      if (!noteBody.success) {
        setLoadError(noteBody.error?.message ?? 'Failed to load data.');
        return;
      }
      setAssignments(assignBody.data ?? []);
      setNotes(noteBody.data ?? []);
    } catch {
      setLoadError('Failed to load client data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading client data…" />
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back + actions */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/therapist/clients')}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          ← Back to clients
        </button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/session-notes/new?clientId=${clientId}`)}
          >
            New Note
          </Button>
          <Button
            type="button"
            onClick={() => router.push(`/worksheet-assignments/new?clientId=${clientId}`)}
          >
            Assign Worksheet
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Client sections"
        className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      >
        {(
          [
            { key: 'worksheets', label: `Worksheets (${assignments.length})` },
            { key: 'notes', label: `Session Notes (${notes.length})` },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Worksheets tab */}
      {activeTab === 'worksheets' && (
        <>
          {assignments.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted)]">
              No worksheets assigned to this client yet.
            </p>
          ) : (
            <ul className="space-y-3" aria-label="Worksheet assignments">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-[var(--color-foreground)]">{a.template.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-[var(--color-muted)]">
                      {a.template.type.replace('_', ' ')}
                      {a.dueDate ? ` · Due ${new Date(a.dueDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[a.status]}`}
                  >
                    {a.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Session notes tab */}
      {activeTab === 'notes' && (
        <>
          {notes.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted)]">
              No session notes for this client yet.
            </p>
          ) : (
            <ul className="space-y-3" aria-label="Session notes">
              {[...notes]
                .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
                .map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/session-notes/${note.id}/edit`)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left transition-colors hover:bg-[var(--color-background)]"
                    >
                      <div>
                        <p className="font-medium text-[var(--color-foreground)]">
                          {note.sessionDate}
                        </p>
                        <p className="mt-0.5 text-xs capitalize text-[var(--color-muted)]">
                          {note.sessionType}
                        </p>
                        {note.subjective && (
                          <p className="mt-1 line-clamp-1 text-xs text-[var(--color-muted)]">
                            {note.subjective}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-4 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          note.status === 'FINALIZED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {note.status === 'FINALIZED' ? 'Finalized' : 'Draft'}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
