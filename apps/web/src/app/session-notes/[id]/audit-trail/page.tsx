'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditTrailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/audit-logs?resourceType=session_note&resourceId=${encodeURIComponent(id)}`,
      );
      const body = (await res.json()) as {
        success: boolean;
        data: AuditLogEntry[];
        error?: { message: string };
      };
      if (body.success) {
        setLogs(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load audit trail.');
      }
    } catch {
      setLoadError('Failed to load audit trail. Please try again.');
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
        <Spinner label="Loading audit trail…" />
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
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Audit Trail</h1>
        <Button type="button" variant="outline" onClick={() => router.push('/session-notes')}>
          Back
        </Button>
      </div>

      {logs.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-muted)]">No audit logs found.</p>
      ) : (
        <ol className="space-y-3">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">{log.action}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-[var(--color-muted)]">
                <span>Actor: {log.actorId ?? 'system'}</span>
                <span>IP: {log.ipAddress}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
