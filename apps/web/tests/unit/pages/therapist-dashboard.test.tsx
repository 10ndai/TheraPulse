import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import TherapistDashboardPage from '../../../src/app/dashboard/therapist/page';

const mockStats = {
  totalAssignments: 10,
  completedAssignments: 6,
  totalNotes: 4,
};

const mockResponse = { success: true, data: mockStats };

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Therapist dashboard page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<TherapistDashboardPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows total assignments stat card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('shows completed assignments stat card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument();
    });
  });

  it('shows total session notes stat card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows quick action to create a new session note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => screen.getByRole('button', { name: /new session note/i }));
    fireEvent.click(screen.getByRole('button', { name: /new session note/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes/new');
  });

  it('shows quick action to view session notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => screen.getByRole('button', { name: /view session notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /view session notes/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes');
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Forbidden' } }),
      }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false without message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) }),
    );
    render(<TherapistDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
