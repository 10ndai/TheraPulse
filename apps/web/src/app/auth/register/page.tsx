'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { publicRegisterSchema } from '@therapulse/shared';
import type { PublicRegisterDto } from '@therapulse/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage(): React.JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PublicRegisterDto>({
    resolver: zodResolver(publicRegisterSchema),
  });

  const onSubmit = async (data: PublicRegisterDto): Promise<void> => {
    setServerError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Strip confirmPassword — NestJS doesn't expect it
        body: JSON.stringify({ email: data.email, password: data.password, role: data.role }),
      });

      const body = (await response.json()) as { success: boolean; error?: { message: string } };

      if (!response.ok) {
        setServerError(body.error?.message ?? 'Registration failed. Please try again.');
        return;
      }

      setSuccess(true);
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Image
              src="/logo.png"
              alt="TheraPulse"
              width={720}
              height={208}
              className="w-full max-w-[360px] h-auto mx-auto logo-tint"
            />
          </div>
          <h1 className="text-2xl font-bold">Account created!</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Please{' '}
            <Link href="/auth/login" className="text-[var(--color-primary)] hover:underline">
              log in
            </Link>{' '}
            to continue.
          </p>
        </div>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[var(--color-primary)] hover:underline">
            Log in
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
              autoComplete="new-password"
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

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" required>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? 'true' : undefined}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              {...register('confirmPassword')}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p
                id="confirm-error"
                role="alert"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <Label htmlFor="role" required>
              Role
            </Label>
            <select
              id="role"
              aria-label="Role"
              aria-invalid={errors.role ? 'true' : undefined}
              aria-describedby={errors.role ? 'role-error' : undefined}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              {...register('role')}
            >
              <option value="">Select a role</option>
              <option value="CLIENT">Client</option>
              <option value="THERAPIST">Therapist</option>
            </select>
            {errors.role && (
              <p
                id="role-error"
                role="alert"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.role.message}
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
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
