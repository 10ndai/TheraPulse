import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkipLink } from '../../../../src/components/ui/skip-link';

describe('SkipLink', () => {
  it('renders an anchor tag', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('points to #main-content', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#main-content');
  });

  it('has descriptive accessible text', () => {
    render(<SkipLink />);
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
  });
});
