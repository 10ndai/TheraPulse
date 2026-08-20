import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('recharts', () => ({
  BarChart: vi.fn(() => null),
  Bar: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  ResponsiveContainer: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/admin',
}));

import AdminPlatformDashboardPage from '../../../src/app/dashboard/admin/page';

const mockStats = {
  totalTherapists: 12,
  totalClients: 48,
  totalWorksheetSubmissions: 203,
  totalSessionNotes: 87,
};

const mockResponse = { success: true, data: mockStats };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Admin platform dashboard page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<AdminPlatformDashboardPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows total therapists stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('shows total clients stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('48')).toBeInTheDocument();
    });
  });

  it('shows total worksheet submissions stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('203')).toBeInTheDocument();
    });
  });

  it('shows total session notes stat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('87')).toBeInTheDocument();
    });
  });

  it('shows stat labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/therapists/i)).toBeInTheDocument();
      expect(screen.getByText(/clients/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<AdminPlatformDashboardPage />);
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
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });

  it('shows error without message falls back to default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false }),
      }),
    );
    render(<AdminPlatformDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
