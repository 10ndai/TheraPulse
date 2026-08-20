'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TherapistCard } from '@/components/directory/therapist-card';
import type { TherapistProfileSummary } from '@/components/directory/therapist-card';
import type { PaginationMeta } from '@therapulse/shared';

const PAGE_LIMIT = 12;

interface DirectoryFilters {
  name: string;
  city: string;
  specialization: string;
}

interface DirectoryResponse {
  success: boolean;
  data: TherapistProfileSummary[];
  meta: PaginationMeta;
  error?: { message: string };
}

async function fetchTherapists(
  filters: DirectoryFilters,
  page: number,
): Promise<DirectoryResponse> {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.city) params.set('city', filters.city);
  if (filters.specialization) params.set('specialization', filters.specialization);
  params.set('page', String(page));
  params.set('limit', String(PAGE_LIMIT));

  const response = await fetch(`/api/directory/therapists?${params.toString()}`);
  return response.json() as Promise<DirectoryResponse>;
}

function DirectoryBrowser(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<DirectoryFilters>({
    name: searchParams.get('name') ?? '',
    city: searchParams.get('city') ?? '',
    specialization: searchParams.get('specialization') ?? '',
  });
  const [inputValues, setInputValues] = useState<DirectoryFilters>({ ...filters });
  const [therapists, setTherapists] = useState<TherapistProfileSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track latest request to ignore stale responses
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (activeFilters: DirectoryFilters, activePage: number): Promise<void> => {
      const id = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchTherapists(activeFilters, activePage);
        if (id !== requestIdRef.current) return; // stale
        if (result.success) {
          setTherapists(result.data);
          setMeta(result.meta);
        } else {
          setError(result.error?.message ?? 'Failed to load therapists.');
        }
      } catch {
        if (id !== requestIdRef.current) return;
        setError('Failed to load therapists. Please try again.');
      } finally {
        if (id === requestIdRef.current) setIsLoading(false);
      }
    },
    [],
  );

  // Load on mount and whenever committed filters / page change
  useEffect(() => {
    void load(filters, page);
  }, [filters, page, load]);

  // Sync committed filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.city) params.set('city', filters.city);
    if (filters.specialization) params.set('specialization', filters.specialization);
    if (page > 1) params.set('page', String(page));
    router.push(`/directory?${params.toString()}`, { scroll: false } as never);
  }, [filters, page, router]);

  const handleSearch = (): void => {
    setPage(1);
    setFilters({ ...inputValues });
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Heading */}
      <h1 className="text-3xl font-bold text-[var(--color-foreground)]">Find a Therapist</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Browse approved therapists and connect with the right professional for you.
      </p>

      {/* Search form */}
      <div
        role="search"
        aria-label="Search therapists"
        className="mt-6 flex flex-wrap gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <Input
          type="text"
          placeholder="Name"
          aria-label="Search by name"
          value={inputValues.name}
          onChange={(e) => setInputValues((v) => ({ ...v, name: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="min-w-36 flex-1"
        />
        <Input
          type="text"
          placeholder="City"
          aria-label="Filter by city"
          value={inputValues.city}
          onChange={(e) => setInputValues((v) => ({ ...v, city: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="min-w-36 flex-1"
        />
        <Input
          type="text"
          placeholder="Specialization"
          aria-label="Filter by specialization"
          value={inputValues.specialization}
          onChange={(e) => setInputValues((v) => ({ ...v, specialization: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="min-w-40 flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          Search
        </Button>
      </div>

      {/* Results */}
      <div className="mt-8">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner label="Loading therapists…" />
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
            No therapists found. Try adjusting your search filters.
          </p>
        )}

        {!isLoading && !error && therapists.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Therapist results">
            {therapists.map((profile) => (
              <TherapistCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
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

/**
 * useSearchParams() opts the subtree into client-side rendering, so Next.js
 * requires a Suspense boundary above it for the route to prerender.
 */
export default function DirectoryPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading…" />
        </div>
      }
    >
      <DirectoryBrowser />
    </Suspense>
  );
}
