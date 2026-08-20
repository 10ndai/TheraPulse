'use client';

interface SpinnerProps {
  label?: string;
  className?: string;
}

/**
 * Accessible loading spinner.
 * Uses role="status" + aria-label so screen readers announce the loading state.
 */
export function Spinner({ label = 'Loading…', className }: SpinnerProps): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        'inline-block h-5 w-5 animate-spin rounded-full border-2',
        'border-[var(--color-border)] border-t-[var(--color-primary)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
