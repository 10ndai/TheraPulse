'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorksheetTemplate {
  id: string;
  title: string;
  type: string;
  isPublished: boolean;
  version: number;
  createdAt: string;
}

type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

interface WorksheetAssignment {
  id: string;
  status: AssignmentStatus;
  dueDate: string | null;
  createdAt: string;
  template: { id: string; title: string };
  client?: { id: string; name: string };
}

type TabKey = 'templates' | 'assignments';

const STATUS_BADGE: Record<AssignmentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TherapistWorksheetsPage(): React.JSX.Element {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>('templates');
  const [templates, setTemplates] = useState<WorksheetTemplate[]>([]);
  const [assignments, setAssignments] = useState<WorksheetAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tmplRes, assignRes] = await Promise.all([
        fetch('/api/worksheet-templates?limit=100'),
        fetch('/api/worksheet-assignments?limit=50'),
      ]);
      const [tmplBody, assignBody] = await Promise.all([
        tmplRes.json() as Promise<{
          success: boolean;
          data: WorksheetTemplate[];
          error?: { message: string };
        }>,
        assignRes.json() as Promise<{
          success: boolean;
          data: WorksheetAssignment[];
          error?: { message: string };
        }>,
      ]);
      if (reqId !== requestIdRef.current) return;
      if (!tmplBody.success) {
        setLoadError(tmplBody.error?.message ?? 'Failed to load templates.');
        return;
      }
      if (!assignBody.success) {
        setLoadError(assignBody.error?.message ?? 'Failed to load assignments.');
        return;
      }
      setTemplates(tmplBody.data);
      setAssignments(assignBody.data);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoadError('Failed to load worksheet data. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading worksheets…" />
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Worksheets</h1>
        <div className="flex gap-2">
          {activeTab === 'templates' ? (
            <Button type="button" onClick={() => router.push('/worksheet-templates')}>
              Manage Templates
            </Button>
          ) : (
            <Button type="button" onClick={() => router.push('/worksheet-assignments/new')}>
              Assign Worksheet
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Worksheet sections"
        className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      >
        {(
          [
            { key: 'templates', label: `Templates (${templates.length})` },
            { key: 'assignments', label: `Assignments (${assignments.length})` },
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

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <>
          {templates.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted)]">No templates yet.</p>
          ) : (
            <ul className="space-y-3" aria-label="Worksheet templates">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-[var(--color-foreground)]">{t.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-[var(--color-muted)]">
                      {t.type.replace('_', ' ')} · v{t.version}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/worksheet-templates/${t.id}/edit`)}
                      aria-label={`Edit ${t.title}`}
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Assignments tab */}
      {activeTab === 'assignments' && (
        <>
          {assignments.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted)]">
              No assignments created yet.
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
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {a.dueDate
                        ? `Due ${new Date(a.dueDate).toLocaleDateString()}`
                        : 'No due date'}
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
    </div>
  );
}
