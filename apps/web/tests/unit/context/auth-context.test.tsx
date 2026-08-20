import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../../../src/context/auth-context';

// Helper component that renders auth state
function AuthConsumer(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div data-testid="loading">loading</div>;
  if (!user) return <div data-testid="unauthenticated">unauthenticated</div>;
  return <div data-testid="user-email">{user.email}</div>;
}

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: 'THERAPIST' as const,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides isLoading=true while fetching, then resolves to user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockUser }),
      }),
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toBeInTheDocument();
    });
    expect(screen.getByTestId('user-email').textContent).toBe('therapist@example.com');
  });

  it('sets user to null when /api/auth/me returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        }),
      }),
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
    });
  });

  it('sets user to null when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
    });
  });

  it('refetch re-fetches /api/auth/me and updates state', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockUser }),
        }),
    );

    function RefetchConsumer(): React.JSX.Element {
      const { user, isLoading, refetch } = useAuth();
      if (isLoading) return <div data-testid="loading">loading</div>;
      return (
        <div>
          {user ? (
            <span data-testid="user-email">{user.email}</span>
          ) : (
            <span data-testid="unauthenticated">none</span>
          )}
          <button data-testid="refetch" onClick={() => void refetch()}>
            refetch
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <RefetchConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('refetch').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toBeInTheDocument();
    });
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress the React error boundary noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Thrower(): React.JSX.Element {
      useAuth();
      return <div />;
    }

    expect(() => render(<Thrower />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });
});
