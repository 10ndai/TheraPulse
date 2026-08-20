'use client';

import { forwardRef } from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Accessible text input. Supports all native input attributes.
 * Adds a visible focus ring, aria-invalid styling, and full-width layout.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={[
        'block w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]',
        'placeholder:text-[var(--color-muted)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        'aria-[invalid=true]:border-[var(--color-destructive)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
