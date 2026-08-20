'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { SafeUser } from '@therapulse/shared';
import { z } from 'zod';

// Local schema: only token (userId comes from URL params)
const tokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'TOTP code must be exactly 6 digits'),
});
type TokenForm = z.infer<typeof tokenSchema>;

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin',
  THERAPIST: '/therapist/clients',
  CLIENT: '/client/worksheets',
};

function TwoFaForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();
  const userId = searchParams.get('userId') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
  });

  const onSubmit = async (data: TokenForm): Promise<void> => {
    setServerError(null);
    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token: data.token }),
      });

      const body = (await response.json()) as {
        success: boolean;
        data?: { user?: SafeUser };
        error?: { message: string };
      };

      if (!response.ok) {
        setServerError(body.error?.message ?? 'Verification failed. Please try again.');
        return;
      }

      await refetch();
      const role = body.data?.user?.role ?? 'CLIENT';
      router.push(ROLE_REDIRECT[role] ?? '/');
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <h1 className="text-2xl font-bold">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          <div>
            <Label htmlFor="token" required>
              Verification Code
            </Label>
            <Input
              id="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              aria-invalid={errors.token ? 'true' : undefined}
              aria-describedby={errors.token ? 'token-error' : undefined}
              {...register('token')}
              className="mt-1 text-center text-lg tracking-widest"
            />
            {errors.token && (
              <p
                id="token-error"
                role="alert"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.token.message}
              </p>
            )}
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-md bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]"
            >
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Verifying…' : 'Verify'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href="/auth/login" className="text-[var(--color-primary)] hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * useSearchParams() opts the subtree into client-side rendering, so Next.js
 * requires a Suspense boundary above it for the route to prerender.
 */
export default function TwoFaPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading…" />
        </div>
      }
    >
      <TwoFaForm />
    </Suspense>
  );
}
