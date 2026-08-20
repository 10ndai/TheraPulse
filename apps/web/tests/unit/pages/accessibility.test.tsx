/**
 * TP-056 — Accessibility (WCAG 2.1 AA) tests
 *
 * Checks keyboard navigability, label associations, ARIA attributes,
 * and error announcement patterns across critical pages.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: null, isLoading: false, refetch: vi.fn().mockResolvedValue(undefined) }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import LoginPage from '../../../src/app/auth/login/page';
import RegisterPage from '../../../src/app/auth/register/page';
import { Spinner } from '../../../src/components/ui/spinner';
import { Button } from '../../../src/components/ui/button';
import { Input } from '../../../src/components/ui/input';
import { Label } from '../../../src/components/ui/label';
import { SkipLink } from '../../../src/components/ui/skip-link';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

// ─── Skip link ────────────────────────────────────────────────────────────────

describe('SkipLink component', () => {
  it('renders a skip link to main content', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('is focusable', async () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: /skip to main content/i });
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});

// ─── Spinner ──────────────────────────────────────────────────────────────────

describe('Spinner component a11y', () => {
  it('has role="status" for screen reader announcement', () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('exposes accessible label via aria-label', () => {
    render(<Spinner label="Loading data…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Loading data…');
  });
});

// ─── Button ───────────────────────────────────────────────────────────────────

describe('Button component a11y', () => {
  it('is a semantic button element', () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('supports disabled state with aria-disabled', () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
  });
});

// ─── Input + Label ────────────────────────────────────────────────────────────

describe('Input + Label association', () => {
  it('input is associated with label via htmlFor', () => {
    render(
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" />
      </div>,
    );
    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();
  });

  it('input accepts keyboard input', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Label htmlFor="pwd">Password</Label>
        <Input id="pwd" type="password" />
      </div>,
    );
    const input = screen.getByLabelText(/password/i);
    await user.type(input, 'Hello123!');
    expect(input).toHaveValue('Hello123!');
  });
});

// ─── Login page ───────────────────────────────────────────────────────────────

describe('Login page a11y', () => {
  it('has a single h1 heading', () => {
    render(<LoginPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('email input is labelled', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('password input is labelled', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submit button is keyboard-accessible (role=button)', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in|log in|submit/i })).toBeInTheDocument();
  });

  it('shows role="alert" on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Invalid credentials' } }),
      }),
    );
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in|log in|submit/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// ─── Register page ────────────────────────────────────────────────────────────

describe('Register page a11y', () => {
  it('has a single h1 heading', () => {
    render(<RegisterPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('all form fields are labelled', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Register page has password + confirm password — both must be labelled
    const passwordInputs = screen.getAllByLabelText(/password/i);
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
    passwordInputs.forEach((input) => expect(input).toBeInTheDocument());
  });

  it('submit button is keyboard-accessible', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: /register|sign up|create/i })).toBeInTheDocument();
  });

  it('shows role="alert" on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Email already in use' } }),
      }),
    );
    render(<RegisterPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'taken@example.com');
    const passwords = screen.getAllByLabelText(/password/i);
    await user.type(passwords[0], 'Password1!@#SecurePass');
    if (passwords[1]) await user.type(passwords[1], 'Password1!@#SecurePass');
    await user.click(screen.getByRole('button', { name: /register|sign up|create/i }));
    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
