import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Label } from '../../../../src/components/ui/label';

describe('Label', () => {
  it('renders its text content', () => {
    render(<Label>Email address</Label>);
    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  it('associates with an input via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<Label className="custom">Label</Label>);
    expect(screen.getByText('Label').className).toContain('custom');
  });

  it('shows required indicator when required prop is set', () => {
    render(<Label required>Name</Label>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
