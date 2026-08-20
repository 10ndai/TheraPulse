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
  isSystem: boolean;
  version: number;
  formSchema: {
    version: number;
    fields?: WorksheetTemplateField[];
  };
  createdById: string;
  createdAt: string;
}

interface WorksheetTemplateField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  content?: string;
  min?: number;
  max?: number;
  rows?: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const WORKSHEET_TYPES = [
  'ALL',
  'ASSESSMENT',
  'CBT',
  'MINDFULNESS',
  'JOURNALING',
  'GOAL_SETTING',
  'CUSTOM',
] as const;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorksheetLibraryPage(): React.JSX.Element {
  const router = useRouter();

  const [templates, setTemplates] = useState<WorksheetTemplate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WorksheetTemplate | null>(null);

  const requestIdRef = useRef(0);

  const loadTemplates = useCallback(async (): Promise<void> => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await fetch(`/api/worksheet-templates?${params.toString()}`);
      const body = (await res.json()) as {
        success: boolean;
        data: WorksheetTemplate[];
        meta: PaginationMeta;
        error?: { message: string };
      };
      if (reqId !== requestIdRef.current) return;
      if (body.success) {
        setTemplates(body.data);
        setMeta(body.meta);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load templates.');
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoadError('Failed to load templates. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleTypeFilter = (type: string): void => {
    setTypeFilter(type);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading templates…" />
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">Worksheet Library</h1>

      {/* Type filter bar */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {WORKSHEET_TYPES.map((type) => (
          <Button
            key={type}
            variant={typeFilter === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter(type)}
            aria-pressed={typeFilter === type}
          >
            {type === 'ALL' ? 'All' : type.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      {templates.length === 0 ? (
        <p className="py-16 text-center text-[var(--color-muted)]">No templates found.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Worksheet templates">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onPreview={() => setPreviewTemplate(tpl)}
              onUse={() => router.push(`/worksheet-templates/${tpl.id}/edit`)}
            />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--color-muted)]">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      )}

      {/* Preview dialog */}
      {previewTemplate && (
        <PreviewDialog template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: WorksheetTemplate;
  onPreview: () => void;
  onUse: () => void;
}

function TemplateCard({ template, onPreview, onUse }: TemplateCardProps): React.JSX.Element {
  const fieldCount = template.formSchema.fields?.length ?? 0;

  return (
    <li className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug text-[var(--color-foreground)]">
          {template.title}
        </h2>
        {template.isPublished && (
          <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
            Published
          </span>
        )}
      </div>

      <p className="mb-1 text-xs text-[var(--color-muted)]">{template.type.replace('_', ' ')}</p>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        {fieldCount} {fieldCount === 1 ? 'field' : 'fields'} · v{template.version}
      </p>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onPreview} className="flex-1">
          Preview
        </Button>
        <Button size="sm" onClick={onUse} className="flex-1">
          Use Template
        </Button>
      </div>
    </li>
  );
}

// ─── PreviewDialog ────────────────────────────────────────────────────────────

interface PreviewDialogProps {
  template: WorksheetTemplate;
  onClose: () => void;
}

function PreviewDialog({ template, onClose }: PreviewDialogProps): React.JSX.Element {
  const fields = template.formSchema.fields ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--color-background)] p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>

        <h2
          id="preview-dialog-title"
          className="mb-2 text-xl font-bold text-[var(--color-foreground)]"
        >
          {template.title}
        </h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">{template.type.replace('_', ' ')}</p>

        {fields.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-muted)]">No fields to preview.</p>
        ) : (
          <div className="space-y-6">
            {fields.map((field) => (
              <PreviewField key={field.id} field={field} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewField({ field }: { field: WorksheetTemplateField }): React.JSX.Element {
  switch (field.type) {
    case 'label':
      return (
        <div>
          <p className="text-base font-semibold">{field.label}</p>
          {field.content && (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{field.content}</p>
          )}
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}</label>
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
          <legend className="text-sm font-medium">{field.label}</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(field.options ?? []).map((opt) => (
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
          <label className="block text-sm font-medium">{field.label}</label>
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
    default:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}</label>
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
