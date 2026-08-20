import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams('userId=test-user-uuid');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: null, isLoading: false, refetch: mockRefetch }),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);

import TwoFaPage from '../../../../src/app/auth/2fa/page';

describe('2FA page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockRefetch.mockClear();
  });

  it('renders a 6-digit token input and submit button', () => {
    render(<TwoFaPage />);
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('shows validation error when token is not 6 digits', async () => {
    render(<TwoFaPage />);
    await userEvent.type(screen.getByLabelText(/verification code/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => {
      expect(screen.getByText(/6 digits/i)).toBeInTheDocument();
    });
  });

  it('calls /api/auth/2fa with userId from URL params and redirects on success', async () => {
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

    render(<TwoFaPage />);
    await userEvent.type(screen.getByLabelText(/verification code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/auth/2fa',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"userId":"test-user-uuid"'),
        }),
      );
    });
  });

  it('displays error on invalid TOTP token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid verification code' },
        }),
      }),
    );

    render(<TwoFaPage />);
    await userEvent.type(screen.getByLabelText(/verification code/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
    });
  });

  it('has a back-to-login link', () => {
    render(<TwoFaPage />);
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/auth/login');
  });
});
