'use client';

/**
 * SkipLink — renders off-screen until focused.
 * Allows keyboard users to jump directly to #main-content, satisfying WCAG 2.4.1.
 */
export function SkipLink(): React.JSX.Element {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-[var(--color-primary-foreground)] focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
