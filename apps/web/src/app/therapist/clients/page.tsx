'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  email: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TherapistClientsPage(): React.JSX.Element {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/therapist-clients?limit=100');
      const body = (await res.json()) as {
        success: boolean;
        data: Client[];
        error?: { message: string };
      };
      if (body.success) {
        setClients(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load clients.');
      }
    } catch {
      setLoadError('Failed to load clients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading clients…" />
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

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">My Clients</h1>
        <Button type="button" onClick={() => router.push('/worksheet-assignments/new')}>
          Assign Worksheet
        </Button>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search clients"
        className="mb-4 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      />

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-muted)]">
          {clients.length === 0 ? 'No clients assigned yet.' : 'No clients match your search.'}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Client list">
          {filtered.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                onClick={() => router.push(`/therapist/clients/${client.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left transition-colors hover:bg-[var(--color-background)]"
                aria-label={`View ${client.name ?? 'client'}`}
              >
                <div>
                  <p className="font-semibold text-[var(--color-foreground)]">
                    {client.name ?? '(no name)'}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">{client.email ?? ''}</p>
                </div>
                <span aria-hidden="true" className="text-[var(--color-muted)]">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
