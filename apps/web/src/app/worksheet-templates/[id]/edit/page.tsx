'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { FieldType } from '@therapulse/shared';
import type { WorksheetField, FieldTypeValue } from '@therapulse/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorksheetTemplate {
  id: string;
  title: string;
  type: string;
  isPublished: boolean;
  formSchema: {
    version: number;
    description?: string;
    fields?: WorksheetField[];
  };
}

/**
 * WorksheetField is a discriminated union, so an interface cannot extend it.
 * An intersection distributes over the union and preserves the `type`
 * discriminant, keeping per-variant narrowing intact.
 */
type BuilderField = WorksheetField & {
  _key: string; // stable React key independent of field id
};

// ─── Field type metadata ──────────────────────────────────────────────────────

const FIELD_TYPE_META: { type: FieldTypeValue; label: string; defaultLabel: string }[] = [
  { type: FieldType.TEXT, label: 'Text Field', defaultLabel: 'New Text Field' },
  { type: FieldType.TEXTAREA, label: 'Textarea', defaultLabel: 'New Textarea' },
  { type: FieldType.NUMBER, label: 'Number', defaultLabel: 'New Number Field' },
  { type: FieldType.RATING, label: 'Rating Scale', defaultLabel: 'New Rating Scale' },
  { type: FieldType.SELECT, label: 'Select', defaultLabel: 'New Select Field' },
  { type: FieldType.MULTI_SELECT, label: 'Multi-Select', defaultLabel: 'New Multi-Select Field' },
  { type: FieldType.CHECKBOX, label: 'Checkbox', defaultLabel: 'New Checkbox' },
  { type: FieldType.LIKERT, label: 'Likert Scale', defaultLabel: 'New Likert Scale' },
  { type: FieldType.DATE, label: 'Date', defaultLabel: 'New Date Field' },
  { type: FieldType.LABEL, label: 'Label / Instruction', defaultLabel: 'New Label' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDefaultField(type: FieldTypeValue, defaultLabel: string): WorksheetField {
  const id = `field_${Date.now()}`;
  switch (type) {
    case 'select':
    case 'multi_select':
      return {
        id,
        type,
        label: defaultLabel,
        required: false,
        options: [
          { value: 'option_1', label: 'Option 1' },
          { value: 'option_2', label: 'Option 2' },
        ],
      } as WorksheetField;
    case 'likert':
      return {
        id,
        type,
        label: defaultLabel,
        required: false,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Sometimes' },
          { value: 2, label: 'Often' },
          { value: 3, label: 'Always' },
        ],
      } as WorksheetField;
    case 'rating':
      return { id, type, label: defaultLabel, required: false, min: 0, max: 10 } as WorksheetField;
    case 'textarea':
      return { id, type, label: defaultLabel, required: false, rows: 4 } as WorksheetField;
    case 'label':
      return { id, type, label: defaultLabel, content: 'Enter content here' } as WorksheetField;
    default:
      return { id, type, label: defaultLabel, required: false } as WorksheetField;
  }
}

function toBuilderField(field: WorksheetField): BuilderField {
  return { ...field, _key: `${field.id}_${Date.now()}` };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BuilderPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const titleId = useId();

  const [template, setTemplate] = useState<WorksheetTemplate | null>(null);
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const requestIdRef = useRef(0);

  const loadTemplate = useCallback(async (): Promise<void> => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/worksheet-templates/${id}`);
      const body = (await res.json()) as {
        success: boolean;
        data: WorksheetTemplate;
        error?: { message: string };
      };
      if (reqId !== requestIdRef.current) return;
      if (body.success) {
        setTemplate(body.data);
        setTitle(body.data.title);
        setFields((body.data.formSchema.fields ?? []).map(toBuilderField));
      } else {
        setLoadError(body.error?.message ?? 'Failed to load template.');
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoadError('Failed to load template. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const addField = (meta: { type: FieldTypeValue; defaultLabel: string }): void => {
    const field = makeDefaultField(meta.type, meta.defaultLabel);
    setFields((prev) => [...prev, toBuilderField(field)]);
  };

  const deleteField = (key: string): void => {
    setFields((prev) => prev.filter((f) => f._key !== key));
  };

  const moveField = (key: string, direction: 'up' | 'down'): void => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f._key === key);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx > prev.length - 1) return prev;

      const current = prev[idx];
      const neighbour = prev[swapIdx];
      if (!current || !neighbour) return prev;

      const next = [...prev];
      next[idx] = neighbour;
      next[swapIdx] = current;
      return next;
    });
  };

  const saveDraft = async (): Promise<void> => {
    if (!template) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await fetch(`/api/worksheet-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          formSchema: {
            version: template.formSchema.version,
            description: template.formSchema.description,
            fields: fields.map(({ _key: _, ...field }) => field),
          },
        }),
      });
    } catch {
      setSaveError('Failed to save draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const publishTemplate = async (): Promise<void> => {
    if (!template) return;
    setIsPublishing(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/worksheet-templates/${id}/publish`, { method: 'POST' });
      const body = (await res.json()) as {
        success: boolean;
        data: WorksheetTemplate;
        error?: { message: string };
      };
      if (body.success) {
        setTemplate(body.data);
      } else {
        setSaveError(body.error?.message ?? 'Failed to publish template.');
      }
    } catch {
      setSaveError('Failed to publish template. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading template…" />
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Sidebar: field type palette ─────────────────────────────────── */}
      <aside
        aria-label="Field types"
        className="w-56 shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Add fields
        </p>
        <ul className="space-y-1">
          {FIELD_TYPE_META.map((meta) => (
            <li key={meta.type}>
              <button
                type="button"
                onClick={() => addField(meta)}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--color-primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label={`Add ${meta.label} field`}
              >
                + {meta.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main canvas ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-6 py-3">
          <label htmlFor={titleId} className="sr-only">
            Template title
          </label>
          <input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            placeholder="Template title"
            aria-label="Template title"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreview((p) => !p)}
            aria-label={isPreview ? 'Switch to edit mode' : 'Preview form'}
          >
            {isPreview ? 'Edit' : 'Preview'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => void saveDraft()}
            aria-label="Save draft"
          >
            {isSaving ? 'Saving…' : 'Save Draft'}
          </Button>

          <Button
            size="sm"
            disabled={isPublishing || template?.isPublished === true}
            onClick={() => void publishTemplate()}
            aria-label="Publish template"
          >
            {isPublishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>

        {saveError && (
          <p
            role="alert"
            className="bg-[var(--color-destructive)]/10 px-6 py-2 text-sm text-[var(--color-destructive)]"
          >
            {saveError}
          </p>
        )}

        {/* Canvas / Preview */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isPreview ? (
            <FormPreview fields={fields} />
          ) : (
            <FieldCanvas fields={fields} onDelete={deleteField} onMove={moveField} />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── FieldCanvas ─────────────────────────────────────────────────────────────

interface FieldCanvasProps {
  fields: BuilderField[];
  onDelete: (key: string) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
}

function FieldCanvas({ fields, onDelete, onMove }: FieldCanvasProps): React.JSX.Element {
  if (fields.length === 0) {
    return (
      <p className="py-24 text-center text-[var(--color-muted)]">
        Click a field type on the left to start building your form.
      </p>
    );
  }

  return (
    <ol aria-label="Form fields" className="space-y-3">
      {fields.map((field, idx) => (
        <li
          key={field._key}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-[var(--color-foreground)]">
                {field.label}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--color-muted)] capitalize">{field.type}</p>
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onMove(field._key, 'up')}
                aria-label={`Move up: ${field.label}`}
                className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === fields.length - 1}
                onClick={() => onMove(field._key, 'down')}
                aria-label={`Move down: ${field.label}`}
                className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onDelete(field._key)}
                aria-label={`Delete field ${field.label}`}
                className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-destructive)]"
              >
                ✕
              </button>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── FormPreview ─────────────────────────────────────────────────────────────

function FormPreview({ fields }: { fields: BuilderField[] }): React.JSX.Element {
  if (fields.length === 0) {
    return (
      <p className="py-24 text-center text-[var(--color-muted)]">
        No fields to preview yet. Add some fields in edit mode.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-8">
      {fields.map((field) => (
        <PreviewField key={field._key} field={field} />
      ))}
    </div>
  );
}

function PreviewField({ field }: { field: WorksheetField }): React.JSX.Element {
  switch (field.type) {
    case 'label':
      return (
        <div>
          <p className="text-base font-semibold">{field.label}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{field.content}</p>
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium">
            {field.label}
            {field.required && (
              <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
                *
              </span>
            )}
          </label>
          <textarea
            rows={field.rows ?? 4}
            disabled
            className="mt-1 w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            placeholder="Client response…"
          />
        </div>
      );
    case 'likert':
      return (
        <fieldset>
          <legend className="text-sm font-medium">
            {field.label}
            {field.required && (
              <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
                *
              </span>
            )}
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {field.options.map((opt) => (
              <label
                key={String(opt.value)}
                className="flex cursor-pointer flex-col items-center gap-1 text-xs"
              >
                <input type="radio" disabled name={field.id} value={String(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case 'rating':
      return (
        <div>
          <label className="block text-sm font-medium">
            {field.label}
            {field.required && (
              <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
                *
              </span>
            )}
          </label>
          <div className="mt-2 flex gap-2">
            {Array.from(
              { length: (field.max ?? 10) - (field.min ?? 0) + 1 },
              (_, i) => (field.min ?? 0) + i,
            ).map((v) => (
              <button
                key={v}
                type="button"
                disabled
                className="h-8 w-8 rounded-full border border-[var(--color-border)] text-xs"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium">
            {field.label}
            {field.required && (
              <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
                *
              </span>
            )}
          </label>
          <select
            disabled
            className="mt-1 w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {field.options.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled />
          {field.label}
        </label>
      );
    default:
      return (
        <div>
          <label className="block text-sm font-medium">
            {field.label}
            {'required' in field && field.required && (
              <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
                *
              </span>
            )}
          </label>
          <input
            type="text"
            disabled
            className="mt-1 w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            placeholder="Client response…"
          />
        </div>
      );
  }
}
