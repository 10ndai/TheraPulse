'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'rating'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'likert'
  | 'date'
  | 'label';

interface FieldOption {
  value: string;
  label: string;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  content?: string; // label type
  options?: FieldOption[];
  min?: number;
  max?: number;
}

interface FormSchema {
  version: number;
  fields: FormField[];
}

interface AssignmentTemplate {
  id: string;
  title: string;
  type: string;
  formSchema: FormSchema;
}

interface WorksheetAssignment {
  id: string;
  status: string;
  instructions: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  therapistId: string;
  clientId: string;
  template: AssignmentTemplate;
}

type Responses = Record<string, string | string[] | boolean | number>;

// ─── Debounce utility ─────────────────────────────────────────────────────────

function useDebounce(fn: () => void, delay: number): () => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }, [fn, delay]);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorksheetSubmitPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [assignment, setAssignment] = useState<WorksheetAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Responses>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load assignment
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    fetch(`/api/worksheet-assignments/${id}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          success: boolean;
          data: WorksheetAssignment;
          error?: { message: string };
        };
        if (cancelled) return;
        if (body.success) {
          setAssignment(body.data);
        } else {
          setLoadError(body.error?.message ?? 'Failed to load assignment.');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load assignment. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!assignment) return;
    try {
      await fetch('/api/worksheet-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id, responses, status: 'DRAFT' }),
      });
    } catch {
      // silent auto-save failure — user can still submit manually
    }
  }, [assignment, responses]);

  const debouncedSave = useDebounce(saveDraft, 1000);

  const setField = useCallback(
    (fieldId: string, value: string | boolean | number) => {
      setResponses((prev) => ({ ...prev, [fieldId]: value }));
      debouncedSave();
    },
    [debouncedSave],
  );

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!assignment) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/worksheet-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id, responses, status: 'SUBMITTED' }),
      });
      const body = (await res.json()) as { success: boolean; error?: { message: string } };
      if (body.success) {
        router.push('/worksheet-assignments');
      } else {
        setSubmitError(body.error?.message ?? 'Failed to submit. Please try again.');
      }
    } catch {
      setSubmitError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [assignment, responses, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading worksheet…" />
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

  const { template, instructions } = assignment!;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-foreground)]">{template.title}</h1>

      {instructions && <p className="mb-6 text-sm text-[var(--color-muted)]">{instructions}</p>}

      {submitError && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          {submitError}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-6"
        noValidate
      >
        {template.formSchema.fields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={responses[field.id]}
            onChange={(val) => setField(field.id, val)}
          />
        ))}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/worksheet-assignments')}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} aria-label="Submit worksheet">
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── FormFieldRenderer ────────────────────────────────────────────────────────

interface FormFieldRendererProps {
  field: FormField;
  value: Responses[string] | undefined;
  onChange: (val: string | boolean | number) => void;
}

function FormFieldRenderer({ field, value, onChange }: FormFieldRendererProps): React.JSX.Element {
  const inputId = `field-${field.id}`;

  switch (field.type) {
    case 'label':
      return (
        <div>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            {field.content ?? field.label}
          </p>
        </div>
      );

    case 'likert':
      return (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
            {field.label}
          </legend>
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={field.id}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  aria-label={opt.label}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'textarea':
      return (
        <div>
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            {field.label}
          </label>
          <textarea
            id={inputId}
            aria-label={field.label}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
      );

    case 'rating': {
      const min = field.min ?? 0;
      const max = field.max ?? 10;
      const current = (value as number) ?? -1;
      return (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-foreground)]">{field.label}</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label={field.label}>
            {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={String(n)}
                aria-pressed={current === n}
                onClick={() => onChange(n)}
                className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                  current === n
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'select':
      return (
        <div>
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            {field.label}
          </label>
          <select
            id={inputId}
            aria-label={field.label}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={inputId}
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            aria-label={field.label}
          />
          <label htmlFor={inputId} className="text-sm text-[var(--color-foreground)]">
            {field.label}
          </label>
        </div>
      );

    case 'number':
      return (
        <div>
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            {field.label}
          </label>
          <input
            id={inputId}
            type="number"
            aria-label={field.label}
            value={(value as number) ?? ''}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
      );

    case 'date':
      return (
        <div>
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            {field.label}
          </label>
          <input
            id={inputId}
            type="date"
            aria-label={field.label}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
      );

    default: // text
      return (
        <div>
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            {field.label}
          </label>
          <input
            id={inputId}
            type="text"
            aria-label={field.label}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
      );
  }
}
