import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Page from '../../src/app/page';

describe('Root Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
  });

  it('displays the application name as the logo accessible name', () => {
    render(<Page />);
    expect(screen.getByRole('img', { name: /TheraPulse/i })).toBeInTheDocument();
  });

  it('links to the directory and registration', () => {
    render(<Page />);
    expect(screen.getByRole('link', { name: /find a therapist/i })).toHaveAttribute(
      'href',
      '/directory',
    );
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/auth/register',
    );
  });

  it('renders all three how-it-works steps', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: /how worksheets work/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });
});
