'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useId } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorksheetTemplate {
  id: string;
  title: string;
  type: string;
  isPublished: boolean;
  version: number;
}

interface ClientSummary {
  id: string;
  name: string;
  email: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreateAssignmentPage(): React.JSX.Element {
  const router = useRouter();
  const templateSelectId = useId();
  const clientSelectId = useId();
  const instructionsId = useId();
  const dueDateId = useId();

  const [templates, setTemplates] = useState<WorksheetTemplate[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const loadData = useCallback(async (): Promise<void> => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [templatesRes, clientsRes] = await Promise.all([
        fetch('/api/worksheet-templates?isPublished=true&limit=100'),
        fetch('/api/therapist-clients?limit=100'),
      ]);
      const [templatesBody, clientsBody] = await Promise.all([
        templatesRes.json() as Promise<{
          success: boolean;
          data: WorksheetTemplate[];
          error?: { message: string };
        }>,
        clientsRes.json() as Promise<{
          success: boolean;
          data: ClientSummary[];
          error?: { message: string };
        }>,
      ]);
      if (reqId !== requestIdRef.current) return;
      if (templatesBody.success && clientsBody.success) {
        setTemplates(templatesBody.data);
        setClients(clientsBody.data);
      } else {
        setLoadError(
          templatesBody.error?.message ?? clientsBody.error?.message ?? 'Failed to load data.',
        );
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoadError('Failed to load data. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/worksheet-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          clientId: selectedClientId,
          ...(instructions.trim() && { instructions: instructions.trim() }),
          ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
        }),
      });
      const body = (await res.json()) as { success: boolean; error?: { message: string } };
      if (body.success) {
        router.push('/worksheet-assignments');
      } else {
        setSubmitError(body.error?.message ?? 'Failed to create assignment.');
      }
    } catch {
      setSubmitError('Failed to create assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-xl py-16 text-center text-[var(--color-destructive)]"
      >
        {loadError}
      </p>
    );
  }

  const canSubmit = selectedTemplateId !== '' && selectedClientId !== '';

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">Assign Worksheet</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Template selector */}
        <div>
          <label
            htmlFor={templateSelectId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Worksheet Template
          </label>
          <select
            id={templateSelectId}
            aria-label="Worksheet Template"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <option value="">— Select a template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Client selector */}
        <div>
          <label
            htmlFor={clientSelectId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Client
          </label>
          <select
            id={clientSelectId}
            aria-label="Client"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <option value="">— Select a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Instructions */}
        <div>
          <label
            htmlFor={instructionsId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Instructions <span className="text-[var(--color-muted)]">(optional)</span>
          </label>
          <textarea
            id={instructionsId}
            aria-label="Instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Any specific instructions for the client…"
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>

        {/* Due date */}
        <div>
          <label
            htmlFor={dueDateId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Due Date <span className="text-[var(--color-muted)]">(optional)</span>
          </label>
          <input
            id={dueDateId}
            type="date"
            aria-label="Due date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-[var(--color-destructive)]">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/worksheet-assignments')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="flex-1"
            aria-label="Assign worksheet"
          >
            {isSubmitting ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
