'use client';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

/**
 * Accessible form label. When `required` is true, renders a visible asterisk
 * with an aria-hidden attribute so screen readers don't read "asterisk".
 */
export function Label({ required, children, className, ...props }: LabelProps): React.JSX.Element {
  return (
    <label
      className={['block text-sm font-medium text-[var(--color-foreground)]', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-[var(--color-destructive)]">
          *
        </span>
      )}
    </label>
  );
}
