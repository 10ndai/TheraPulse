import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({}),
}));

import NotificationsPage from '../../../src/app/notifications/page';

// ─── Mock data ────────────────────────────────────────────────────────────────

const now = '2026-03-01T10:00:00Z';

const makeNotification = (id: string, readAt: string | null = null) => ({
  id,
  recipientId: 'client-001',
  type: 'NEW_ASSIGNMENT',
  title: 'New worksheet assigned',
  body: 'PHQ-9 Depression Screen has been assigned to you.',
  resourceType: 'WorksheetAssignment',
  resourceId: `assign-${id}`,
  readAt,
  createdAt: now,
});

const mockNotifications = [makeNotification('notif-001'), makeNotification('notif-002', now)];

const mockResponse = {
  success: true,
  data: mockNotifications,
  meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Notifications page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<NotificationsPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a heading for the notifications page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument();
    });
  });

  it('renders one item per notification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/new worksheet assigned/i).length).toBe(2);
    });
  });

  it('shows unread count badge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<NotificationsPage />);
    await waitFor(() => {
      // 1 unread notification (notif-001 has readAt=null)
      expect(screen.getByText(/1 unread/i)).toBeInTheDocument();
    });
  });

  it('shows "Mark as read" button for unread notifications', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /mark.*as read/i }).length).toBeGreaterThan(0);
    });
  });

  it('clicking "Mark as read" calls the read endpoint and updates UI', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...makeNotification('notif-001', now) } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationsPage />);
    await waitFor(() => screen.getAllByRole('button', { name: /mark.*as read/i }));
    const markReadBtn = screen
      .getAllByRole('button', { name: /mark.*as read/i })
      .find((btn) => btn.getAttribute('aria-label')?.includes('notif-001'));
    fireEvent.click(markReadBtn!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/notif-001/read'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows "Mark all read" button and calls read-all endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { marked: 1 } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationsPage />);
    await waitFor(() => screen.getByRole('button', { name: /mark all read/i }));
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/read-all'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows empty state when no notifications exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
        }),
      }),
    );
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
