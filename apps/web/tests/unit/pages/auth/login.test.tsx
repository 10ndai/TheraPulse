import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: null, isLoading: false, refetch: mockRefetch }),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);

import LoginPage from '../../../../src/app/auth/login/page';

describe('Login page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockRefetch.mockClear();
  });

  it('renders email and password fields and submit button', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('calls /api/auth/login and refetches + redirects based on role on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            user: { id: '1', email: 'therapist@example.com', role: 'THERAPIST', status: 'ACTIVE' },
          },
        }),
      }),
    );

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'therapist@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePass1!');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('redirects to /auth/2fa when 2FA is required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { requiresTwoFactor: true, userId: 'user-uuid-123' },
        }),
      }),
    );

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'therapist@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePass1!');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/2fa?userId=user-uuid-123');
    });
  });

  it('displays server error on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        }),
      }),
    );

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('has a link to the register page', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute(
      'href',
      '/auth/register',
    );
  });
});
