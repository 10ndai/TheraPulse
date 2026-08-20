import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('recharts', () => ({
  LineChart: vi.fn(() => null),
  Line: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  ResponsiveContainer: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/client',
}));

import ClientProgressPage from '../../../src/app/dashboard/client/page';

const mockProgress = {
  totalAssignments: 8,
  completedSubmissions: 5,
  completionRate: 62,
  scoreTrend: [
    { date: '2026-02-01', score: 18 },
    { date: '2026-02-15', score: 14 },
    { date: '2026-03-01', score: 10 },
  ],
};

const mockResponse = { success: true, data: mockProgress };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Client progress page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<ClientProgressPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows completion rate stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText('62%')).toBeInTheDocument();
    });
  });

  it('shows total assignments stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('shows completed submissions stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('renders the score trend chart when trend data exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText('Score Trend')).toBeInTheDocument();
      expect(screen.queryByText(/no score data/i)).not.toBeInTheDocument();
    });
  });

  it('shows "No score data" message when scoreTrend is empty', async () => {
    const noTrendProgress = { ...mockProgress, scoreTrend: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: noTrendProgress }),
      }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText(/no score data/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
      }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false without message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) }),
    );
    render(<ClientProgressPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
