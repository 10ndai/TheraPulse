'use client';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import AdminTherapistsPage from '../../../src/app/admin/therapists/page';

const makeTherapist = (id: string, email: string) => ({
  id,
  email,
  role: 'THERAPIST',
  status: 'PENDING',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
});

const mockPendingResponse = {
  success: true,
  data: [makeTherapist('u-1', 'alice@example.com'), makeTherapist('u-2', 'bob@example.com')],
  meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

describe('Admin therapists page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
  });

  it('renders page heading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<AdminTherapistsPage />);
    expect(
      screen.getByRole('heading', { name: /pending therapist applications/i }),
    ).toBeInTheDocument();
  });

  it('shows a loading spinner while fetching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('renders a row for each pending therapist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPendingResponse,
      }),
    );
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });
  });

  it('shows empty state when no pending therapists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      }),
    );
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no pending applications/i)).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('approve button calls the approve endpoint and removes therapist from list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockPendingResponse })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: makeTherapist('u-1', 'alice@example.com') }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminTherapistsPage />);
    await waitFor(() => screen.getByText('alice@example.com'));

    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const approveCall = calls[calls.length - 1][0] as string;
      expect(approveCall).toContain('/admin/therapists/u-1/approve');
    });

    await waitFor(() => {
      expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
    });
  });

  it('reject button calls the reject endpoint and removes therapist from list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockPendingResponse })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: makeTherapist('u-2', 'bob@example.com') }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminTherapistsPage />);
    await waitFor(() => screen.getByText('bob@example.com'));

    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[1]);

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const rejectCall = calls[calls.length - 1][0] as string;
      expect(rejectCall).toContain('/admin/therapists/u-2/reject');
    });

    await waitFor(() => {
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });
  });

  it('shows next-page button when there are multiple pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [makeTherapist('u-1', 'alice@example.com')],
          meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
        }),
      }),
    );
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('previous-page button is disabled on page 1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [makeTherapist('u-1', 'alice@example.com')],
          meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
        }),
      }),
    );
    render(<AdminTherapistsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });

  it('shows action error when approve fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockPendingResponse })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminTherapistsPage />);
    await waitFor(() => screen.getByText('alice@example.com'));

    fireEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/failed to/i)).toBeInTheDocument();
    });
  });
});
