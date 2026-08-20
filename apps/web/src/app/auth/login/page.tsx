'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@therapulse/shared';
import type { LoginDto } from '@therapulse/shared';
import type { SafeUser } from '@therapulse/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin',
  THERAPIST: '/therapist/clients',
  CLIENT: '/client/worksheets',
};

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const { refetch } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginDto): Promise<void> => {
    setServerError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = (await response.json()) as {
        success: boolean;
        data?: { requiresTwoFactor?: boolean; userId?: string; user?: SafeUser };
        error?: { message: string };
      };

      if (!response.ok) {
        setServerError(body.error?.message ?? 'Login failed. Please try again.');
        return;
      }

      const responseData = body.data;

      if (responseData?.requiresTwoFactor && responseData.userId) {
        router.push(`/auth/2fa?userId=${encodeURIComponent(responseData.userId)}`);
        return;
      }

      // Successful login — refresh auth context and redirect by role
      await refetch();
      const role = responseData?.user?.role ?? 'CLIENT';
      router.push(ROLE_REDIRECT[role] ?? '/');
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.png"
            alt="TheraPulse"
            width={720}
            height={208}
            className="w-full max-w-[360px] h-auto mx-auto logo-tint"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-[var(--color-primary)] hover:underline">
            Register
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
              className="mt-1"
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
              className="mt-1"
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <p
              role="alert"
              className="rounded-md bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]"
            >
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
