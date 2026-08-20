import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/session-notes',
}));

import SessionHistoryPage from '../../../src/app/session-notes/page';

const mockNotes = [
  {
    id: 'note-001',
    therapistId: 'therapist-001',
    clientId: 'client-001',
    sessionDate: '2026-03-01',
    sessionType: 'individual',
    subjective: 'Patient reports improvement.',
    objective: 'Alert and oriented.',
    assessment: 'Moderate depression.',
    plan: 'Continue CBT.',
    status: 'DRAFT',
    version: 1,
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    deletedAt: null,
  },
  {
    id: 'note-002',
    therapistId: 'therapist-001',
    clientId: 'client-002',
    sessionDate: '2026-03-15',
    sessionType: 'group',
    subjective: 'Group dynamics improving.',
    objective: 'Engaged throughout.',
    assessment: 'Progress noted.',
    plan: 'Schedule follow-up.',
    status: 'FINALIZED',
    version: 2,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
    deletedAt: null,
  },
];

const mockResponse = {
  success: true,
  data: mockNotes,
  meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Session history page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionHistoryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the list of session notes after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText('2026-03-01')).toBeInTheDocument();
      expect(screen.getByText('2026-03-15')).toBeInTheDocument();
    });
  });

  it('shows session type for each note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/individual/i)).toBeInTheDocument();
      expect(screen.getByText(/group/i)).toBeInTheDocument();
    });
  });

  it('shows status badges for each note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/finalized/i).length).toBeGreaterThan(0);
    });
  });

  it('shows a New Note button that navigates to /session-notes/new', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByRole('button', { name: /new note/i }));
    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes/new');
  });

  it('expanding a note row reveals SOAP fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByText('2026-03-01'));
    fireEvent.click(screen.getByText('2026-03-01'));
    await waitFor(() => {
      expect(screen.getByText(/patient reports improvement/i)).toBeInTheDocument();
    });
  });

  it('collapsing an expanded row hides SOAP fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByText('2026-03-01'));
    fireEvent.click(screen.getByText('2026-03-01'));
    await waitFor(() => screen.getByText(/patient reports improvement/i));
    fireEvent.click(screen.getByText('2026-03-01'));
    await waitFor(() => {
      expect(screen.queryByText(/patient reports improvement/i)).not.toBeInTheDocument();
    });
  });

  it('clicking Edit on a draft note navigates to the edit page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByText('2026-03-01'));
    fireEvent.click(screen.getByText('2026-03-01'));
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes/note-001/edit');
  });

  it('typing in the search box filters notes client-side', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByText('2026-03-01'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'individual' } });
    await waitFor(() => {
      expect(screen.getByText('2026-03-01')).toBeInTheDocument();
      expect(screen.queryByText('2026-03-15')).not.toBeInTheDocument();
    });
  });

  it('selecting status filter shows only matching notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByText('2026-03-01'));
    const statusSelect = screen.getByRole('combobox', { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: 'FINALIZED' } });
    await waitFor(() => {
      expect(screen.queryByText('2026-03-01')).not.toBeInTheDocument();
      expect(screen.getByText('2026-03-15')).toBeInTheDocument();
    });
  });

  it('shows empty state when no notes exist', async () => {
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
    render(<SessionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/no session notes/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when search has no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionHistoryPage />);
    await waitFor(() => screen.getByPlaceholderText(/search/i));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzznomatch' } });
    await waitFor(() => {
      expect(screen.getByText(/no session notes/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<SessionHistoryPage />);
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
    render(<SessionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });
});
