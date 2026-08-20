import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'note-001' }),
}));

import AuditTrailPage from '../../../src/app/session-notes/[id]/audit-trail/page';

const mockLogs = [
  {
    id: 'log-001',
    actorId: 'user-001',
    action: 'session_note.create',
    resourceType: 'session_note',
    resourceId: 'note-001',
    details: null,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'log-002',
    actorId: 'user-001',
    action: 'session_note.update',
    resourceType: 'session_note',
    resourceId: 'note-001',
    details: { fields: ['subjective'] },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-03-01T11:00:00Z',
  },
  {
    id: 'log-003',
    actorId: 'user-001',
    action: 'session_note.finalize',
    resourceType: 'session_note',
    resourceId: 'note-001',
    details: null,
    ipAddress: '10.0.0.1',
    userAgent: 'Chrome/120',
    createdAt: '2026-03-01T12:00:00Z',
  },
];

const mockResponse = {
  success: true,
  data: mockLogs,
  meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Audit trail page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<AuditTrailPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a list of audit log entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getByText('session_note.create')).toBeInTheDocument();
      expect(screen.getByText('session_note.update')).toBeInTheDocument();
      expect(screen.getByText('session_note.finalize')).toBeInTheDocument();
    });
  });

  it('shows IP address for each log entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/127\.0\.0\.1/).length).toBeGreaterThan(0);
    });
  });

  it('shows actor ID for each log entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/user-001/).length).toBeGreaterThan(0);
    });
  });

  it('shows page heading "Audit Trail"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getByText(/audit trail/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no audit logs exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getByText(/no audit logs/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<AuditTrailPage />);
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
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false without message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) }),
    );
    render(<AuditTrailPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
