'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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

interface NoteFormState {
  clientId: string;
  sessionDate: string;
  sessionType: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionNoteCreatePage(): React.JSX.Element {
  const router = useRouter();

  const [form, setForm] = useState<NoteFormState>({
    clientId: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    sessionType: 'individual',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = useCallback((field: keyof NoteFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(
    async (status: NoteStatus): Promise<SessionNote | null> => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/session-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: form.clientId,
            sessionDate: form.sessionDate,
            sessionType: form.sessionType,
            subjective: form.subjective || null,
            objective: form.objective || null,
            assessment: form.assessment || null,
            plan: form.plan || null,
            status,
          }),
        });
        const body = (await res.json()) as {
          success: boolean;
          data: SessionNote;
          error?: { message: string };
        };
        if (body.success) return body.data;
        setSaveError(body.error?.message ?? 'Failed to save session note.');
        return null;
      } catch {
        setSaveError('Failed to save session note. Please try again.');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [form],
  );

  const handleSaveDraft = useCallback(async () => {
    await save('DRAFT');
  }, [save]);

  const handleFinalize = useCallback(async () => {
    const note = await save('FINALIZED');
    if (note) {
      router.push('/session-notes');
    }
  }, [save, router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">New Session Note</h1>
        <Button type="button" variant="outline" onClick={() => router.push('/session-notes')}>
          Cancel
        </Button>
      </div>

      <div className="space-y-6">
        {/* Date + Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="sessionDate"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Session Date
            </label>
            <input
              id="sessionDate"
              type="date"
              value={form.sessionDate}
              onChange={(e) => handleChange('sessionDate', e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="sessionType"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Session Type
            </label>
            <select
              id="sessionType"
              value={form.sessionType}
              onChange={(e) => handleChange('sessionType', e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="individual">Individual</option>
              <option value="group">Group</option>
              <option value="family">Family</option>
              <option value="couples">Couples</option>
            </select>
          </div>
        </div>

        {/* SOAP Fields */}
        {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
          <div key={field}>
            <label
              htmlFor={field}
              className="mb-1 block text-sm font-medium capitalize text-[var(--color-foreground)]"
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <textarea
              id={field}
              value={form[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      {/* Status/Error */}
      {isSaving && <p className="mt-4 text-sm text-[var(--color-muted)]">Saving…</p>}
      {saveError && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-destructive)]">
          {saveError}
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={() => void handleSaveDraft()}
        >
          Save Draft
        </Button>
        <Button type="button" disabled={isSaving} onClick={() => void handleFinalize()}>
          Finalize
        </Button>
      </div>
    </div>
  );
}
