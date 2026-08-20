import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
}));

const mockReplace = vi.fn();

import RegisterPage from '../../../../src/app/auth/register/page';

describe('Register page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
  });

  it('renders email, password, confirm password, and role fields', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /role/i })).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation error when email is invalid', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterPage />);
    // Fill all required fields so Zod's refine runs (refine only fires when all fields pass)
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'SecurePass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'DifferentPass1!');
    fireEvent.change(screen.getByRole('combobox', { name: /role/i }), {
      target: { value: 'CLIENT' },
    });
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/passwords.+match/i)).toBeInTheDocument();
    });
  });

  it('calls /api/auth/register and redirects to login on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { user: { id: '1', email: 'a@b.com' } } }),
      }),
    );

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'SecurePass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'SecurePass1!');
    fireEvent.change(screen.getByRole('combobox', { name: /role/i }), {
      target: { value: 'CLIENT' },
    });
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows server error message on registration failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: { code: 'CONFLICT', message: 'Email already exists' },
        }),
      }),
    );

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'taken@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'SecurePass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'SecurePass1!');
    fireEvent.change(screen.getByRole('combobox', { name: /role/i }), {
      target: { value: 'CLIENT' },
    });
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('has a link to the login page', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/auth/login');
  });
});
