'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SafeUser } from '@therapulse/shared';
import type { PaginationMeta } from '@therapulse/shared';

const PAGE_LIMIT = 20;

interface PendingResponse {
  success: boolean;
  data: SafeUser[];
  meta: PaginationMeta;
  error?: { message: string };
}

interface ActionResponse {
  success: boolean;
  error?: { message: string };
}

async function fetchPending(page: number): Promise<PendingResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
  const response = await fetch(`/api/admin/therapists/pending?${params.toString()}`);
  return response.json() as Promise<PendingResponse>;
}

async function patchTherapist(id: string, action: 'approve' | 'reject'): Promise<ActionResponse> {
  const response = await fetch(`/api/admin/therapists/${id}/${action}`, { method: 'PATCH' });
  return response.json() as Promise<ActionResponse>;
}

export default function AdminTherapistsPage(): React.JSX.Element {
  const [therapists, setTherapists] = useState<SafeUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const load = useCallback(async (activePage: number): Promise<void> => {
    const id = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPending(activePage);
      if (id !== requestIdRef.current) return;
      if (result.success) {
        setTherapists(result.data);
        setMeta(result.meta);
      } else {
        setError(result.error?.message ?? 'Failed to load applications.');
      }
    } catch {
      if (id !== requestIdRef.current) return;
      setError('Failed to load applications. Please try again.');
    } finally {
      if (id === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  const handleAction = async (id: string, action: 'approve' | 'reject'): Promise<void> => {
    setActingOn(id);
    setActionError(null);
    try {
      const result = await patchTherapist(id, action);
      if (result.success) {
        setTherapists((prev) => prev.filter((t) => t.id !== id));
      } else {
        setActionError(result.error?.message ?? `Failed to ${action} therapist.`);
      }
    } catch {
      setActionError(`Failed to ${action} therapist. Please try again.`);
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--color-foreground)]">
        Pending Therapist Applications
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Review and approve or reject therapist registration requests.
      </p>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]"
        >
          {actionError}
        </p>
      )}

      <div className="mt-8">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner label="Loading applications…" />
          </div>
        )}

        {!isLoading && error && (
          <p
            role="alert"
            className="rounded-md bg-[var(--color-destructive)]/10 p-4 text-[var(--color-destructive)]"
          >
            {error}
          </p>
        )}

        {!isLoading && !error && therapists.length === 0 && (
          <p className="py-16 text-center text-[var(--color-muted)]">
            No pending applications at this time.
          </p>
        )}

        {!isLoading && !error && therapists.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface)] text-left text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {therapists.map((therapist) => (
                  <tr key={therapist.id} className="bg-[var(--color-background)]">
                    <td className="px-4 py-3 text-[var(--color-foreground)]">{therapist.email}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {new Date(therapist.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={actingOn === therapist.id}
                          onClick={() => void handleAction(therapist.id, 'approve')}
                          aria-label={`Approve ${therapist.email}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actingOn === therapist.id}
                          onClick={() => void handleAction(therapist.id, 'reject')}
                          aria-label={`Reject ${therapist.email}`}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            ← Previous
          </Button>
          <span className="text-sm text-[var(--color-muted)]">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
