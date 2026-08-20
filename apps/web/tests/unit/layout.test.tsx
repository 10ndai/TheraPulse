import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RootLayout from '../../src/app/layout';

describe('RootLayout', () => {
  it('renders children', () => {
    render(
      <RootLayout>
        <span data-testid="child">hello</span>
      </RootLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders a body element', () => {
    render(
      <RootLayout>
        <div data-testid="inner" />
      </RootLayout>,
    );
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });
});
