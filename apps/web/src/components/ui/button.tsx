'use client';

import { forwardRef } from 'react';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'default' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]',
  destructive: 'bg-destructive text-[var(--color-destructive-foreground)] hover:opacity-90',
  outline: 'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-accent)]',
  ghost: 'ghost bg-transparent hover:bg-[var(--color-accent)]',
  link: 'underline-offset-4 hover:underline bg-transparent p-0',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-[var(--radius-sm)] px-3 text-sm',
  default: 'h-10 rounded-[var(--radius-md)] px-4 py-2',
  lg: 'h-12 rounded-[var(--radius-lg)] px-6 text-lg',
};

const baseClasses =
  'inline-flex cursor-pointer items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50';

/**
 * Accessible button with variant + size props.
 * Defaults to type="button" to avoid accidental form submission.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'default', size = 'default', type = 'button', className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={[baseClasses, variantClasses[variant], sizeClasses[size], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
