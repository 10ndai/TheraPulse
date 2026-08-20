'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldOption {
  value: string;
  label: string;
}

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  content?: string;
  options?: FieldOption[];
  scoringKey?: string;
}

interface FormSchema {
  version: number;
  fields: FormField[];
}

interface WorksheetTemplate {
  id: string;
  title: string;
  type: string;
  formSchema: FormSchema;
}

interface Assignment {
  id: string;
  therapistId: string;
  clientId: string;
  instructions: string | null;
  dueDate: string | null;
  template: WorksheetTemplate;
}

interface ScoreResult {
  totalScore: number;
  severity: string;
}

interface WorksheetSubmission {
  id: string;
  assignmentId: string;
  clientId: string;
  responses: string;
  score: ScoreResult | null;
  finalizedAt: string | null;
  integrityHash: string;
  createdAt: string;
  assignment: Assignment;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorksheetReviewPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [submission, setSubmission] = useState<WorksheetSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [integrityValid, setIntegrityValid] = useState<boolean | null>(null);

  const loadSubmission = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/worksheet-submissions/${id}`);
      const body = (await res.json()) as {
        success: boolean;
        data: WorksheetSubmission;
        error?: { message: string };
      };
      if (body.success) {
        setSubmission(body.data);
        // Fire-and-forget integrity check — failures are silently ignored
        fetch(`/api/worksheet-submissions/${id}/verify`)
          .then((r) => r.json())
          .then((v: { success: boolean; data?: { valid: boolean } }) => {
            if (v.success && v.data !== undefined) setIntegrityValid(v.data.valid);
          })
          .catch(() => undefined);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load submission.');
      }
    } catch {
      setLoadError('Failed to load submission. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSubmission();
  }, [loadSubmission]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading submission…" />
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

  const { assignment, score, finalizedAt } = submission!;
  const { template } = assignment;

  let responses: Record<string, unknown> = {};
  try {
    responses = JSON.parse(submission!.responses) as Record<string, unknown>;
  } catch {
    // malformed responses — show empty
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{template.title}</h1>
          {finalizedAt && (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Submitted {new Date(finalizedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/worksheet-submissions')}
          aria-label="Back to submissions"
        >
          Back
        </Button>
      </div>

      {/* Score card */}
      {score && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-medium text-[var(--color-muted)]">Total Score</p>
          <p className="text-3xl font-bold text-[var(--color-foreground)]">{score.totalScore}</p>
          <p className="mt-1 text-sm capitalize text-[var(--color-muted)]">{score.severity}</p>
        </div>
      )}

      {/* Integrity badge */}
      {integrityValid !== null && (
        <div className="mb-6">
          {integrityValid ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              Tampered
            </span>
          )}
        </div>
      )}

      {/* Responses */}
      <div className="space-y-6">
        {template.formSchema.fields.map((field) => (
          <ResponseItem key={field.id} field={field} responses={responses} />
        ))}
      </div>
    </div>
  );
}

// ─── ResponseItem ──────────────────────────────────────────────────────────────

interface ResponseItemProps {
  field: FormField;
  responses: Record<string, unknown>;
}

function ResponseItem({ field, responses }: ResponseItemProps): React.JSX.Element {
  if (field.type === 'label') {
    return (
      <div>
        <p className="text-sm font-semibold text-[var(--color-foreground)]">
          {field.content ?? field.label}
        </p>
      </div>
    );
  }

  const responseKey = field.scoringKey ?? field.id;
  const rawValue = responses[responseKey];

  // For likert fields, map value to label
  if (field.type === 'likert' && field.options) {
    const matched = field.options.find((opt) => opt.value === String(rawValue));
    return (
      <div className="border-b border-[var(--color-border)] pb-4">
        <p className="mb-1 text-sm font-medium text-[var(--color-foreground)]">{field.label}</p>
        <p className="text-sm text-[var(--color-muted)]">
          {matched ? matched.label : <span className="italic">(no response)</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--color-border)] pb-4">
      <p className="mb-1 text-sm font-medium text-[var(--color-foreground)]">{field.label}</p>
      <p className="text-sm text-[var(--color-muted)]">
        {rawValue !== undefined && rawValue !== null && rawValue !== '' ? (
          String(rawValue)
        ) : (
          <span className="italic">(no response)</span>
        )}
      </p>
    </div>
  );
}
