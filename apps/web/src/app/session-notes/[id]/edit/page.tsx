'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteStatus = 'DRAFT' | 'FINALIZED';

interface SessionNote {
  id: string;
  therapistId: string;
  clientId: string;
  sessionDate: string;
  sessionType: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: NoteStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface NoteVersion {
  id: string;
  sessionNoteId: string;
  version: number;
  contentSnapshot: string;
  changedById: string;
  createdAt: string;
}

interface NoteFormState {
  sessionDate: string;
  sessionType: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionNoteEditPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [note, setNote] = useState<SessionNote | null>(null);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<NoteFormState>({
    sessionDate: '',
    sessionType: 'individual',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [noteRes, versionsRes] = await Promise.all([
        fetch(`/api/session-notes/${id}`),
        fetch(`/api/session-notes/${id}/versions`),
      ]);
      const noteBody = (await noteRes.json()) as {
        success: boolean;
        data: SessionNote;
        error?: { message: string };
      };
      const versionsBody = (await versionsRes.json()) as { success: boolean; data: NoteVersion[] };

      if (noteBody.success) {
        setNote(noteBody.data);
        setForm({
          sessionDate: noteBody.data.sessionDate.slice(0, 10),
          sessionType: noteBody.data.sessionType,
          subjective: noteBody.data.subjective ?? '',
          objective: noteBody.data.objective ?? '',
          assessment: noteBody.data.assessment ?? '',
          plan: noteBody.data.plan ?? '',
        });
      } else {
        setLoadError(noteBody.error?.message ?? 'Failed to load session note.');
      }

      if (versionsBody.success) {
        setVersions(versionsBody.data);
      }
    } catch {
      setLoadError('Failed to load session note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback((field: keyof NoteFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/session-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDate: form.sessionDate,
          sessionType: form.sessionType,
          subjective: form.subjective || null,
          objective: form.objective || null,
          assessment: form.assessment || null,
          plan: form.plan || null,
        }),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: SessionNote;
        error?: { message: string };
      };
      if (body.success) {
        setNote(body.data);
      } else {
        setSaveError(body.error?.message ?? 'Failed to save session note.');
      }
    } catch {
      setSaveError('Failed to save session note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [id, form]);

  const handleFinalize = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/session-notes/${id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = (await res.json()) as {
        success: boolean;
        data: SessionNote;
        error?: { message: string };
      };
      if (body.success) {
        router.push('/session-notes');
      } else {
        setSaveError(body.error?.message ?? 'Failed to finalize session note.');
      }
    } catch {
      setSaveError('Failed to finalize session note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading session note…" />
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

  const isFinalized = note?.status === 'FINALIZED';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          {isFinalized ? 'Session Note (Finalized)' : 'Edit Session Note'}
        </h1>
        <Button type="button" variant="outline" onClick={() => router.push('/session-notes')}>
          Back
        </Button>
      </div>

      {/* SOAP fields */}
      <div className="space-y-6">
        {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
          <div key={field}>
            <label
              htmlFor={field}
              className="mb-1 block text-sm font-medium capitalize text-[var(--color-foreground)]"
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            {isFinalized ? (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                {form[field] || <span className="italic text-[var(--color-muted)]">(empty)</span>}
              </p>
            ) : (
              <textarea
                id={field}
                value={form[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                rows={4}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {saveError && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-destructive)]">
          {saveError}
        </p>
      )}

      {/* Action buttons — only for drafts */}
      {!isFinalized && (
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void handleFinalize()}>
            Finalize
          </Button>
        </div>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
            Version History
          </h2>
          <ol className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm"
              >
                <span className="font-medium">Version {v.version}</span>
                {' — '}
                <span className="text-[var(--color-muted)]">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
