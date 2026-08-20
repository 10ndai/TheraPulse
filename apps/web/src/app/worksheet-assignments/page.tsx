'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

interface AssignmentTemplate {
  id: string;
  title: string;
  type: string;
}

interface WorksheetAssignment {
  id: string;
  status: AssignmentStatus;
  instructions: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  therapistId: string;
  clientId: string;
  template: AssignmentTemplate;
}

type TabKey = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'PENDING', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDashboardPage(): React.JSX.Element {
  const router = useRouter();
  const [assignments, setAssignments] = useState<WorksheetAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING');

  const requestIdRef = useRef(0);

  const loadAssignments = useCallback(async (): Promise<void> => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/worksheet-assignments?limit=100');
      const body = (await res.json()) as {
        success: boolean;
        data: WorksheetAssignment[];
        error?: { message: string };
      };
      if (reqId !== requestIdRef.current) return;
      if (body.success) {
        setAssignments(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load assignments.');
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoadError('Failed to load assignments. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading your worksheets…" />
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

  const visibleAssignments = assignments.filter((a) => a.status === activeTab);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">My Worksheets</h1>

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Worksheet status tabs"
        className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      >
        {TABS.map((tab) => {
          const count = assignments.filter((a) => a.status === tab.key).length;
          return (
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
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--color-primary)]/20 px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Assignment list */}
      {visibleAssignments.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-muted)]">
          No worksheets in this category.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Worksheet assignments">
          {visibleAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onStart={() => router.push(`/worksheet-assignments/${assignment.id}/submit`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── AssignmentCard ───────────────────────────────────────────────────────────

interface AssignmentCardProps {
  assignment: WorksheetAssignment;
  onStart: () => void;
}

function AssignmentCard({ assignment, onStart }: AssignmentCardProps): React.JSX.Element {
  const { template, status, dueDate, instructions } = assignment;

  const buttonLabel =
    status === 'COMPLETED' ? 'View' : status === 'IN_PROGRESS' ? 'Continue' : 'Start';

  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">{template.title}</h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted)] capitalize">
          {template.type.replace('_', ' ')}
        </p>
        {dueDate && (
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Due: {new Date(dueDate).toLocaleDateString()}
          </p>
        )}
        {instructions && <p className="mt-2 text-sm text-[var(--color-muted)]">{instructions}</p>}
      </div>
      <Button size="sm" onClick={onStart} aria-label={`${buttonLabel} ${template.title}`}>
        {buttonLabel}
      </Button>
    </li>
  );
}
