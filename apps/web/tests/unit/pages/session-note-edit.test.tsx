import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'note-001' }),
}));

import SessionNoteEditPage from '../../../src/app/session-notes/[id]/edit/page';

const mockNote = {
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
};

const mockVersions = [
  {
    id: 'ver-001',
    sessionNoteId: 'note-001',
    version: 1,
    contentSnapshot: '{}',
    changedById: 'therapist-001',
    createdAt: '2026-02-28T10:00:00Z',
  },
];

const mockResponse = { success: true, data: mockNote };
const mockVersionsResponse = { success: true, data: mockVersions };

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Session note edit page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteEditPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the SOAP form with loaded values', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Patient reports improvement.')).toBeInTheDocument();
    });
  });

  it('shows all four SOAP fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/subjective/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/objective/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/assessment/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/plan/i)).toBeInTheDocument();
    });
  });

  it('shows Save and Finalize buttons for draft notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finalize/i })).toBeInTheDocument();
    });
  });

  it('shows version history section with version entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByText(/version history/i)).toBeInTheDocument();
      expect(screen.getByText(/version 1/i)).toBeInTheDocument();
    });
  });

  it('clicking Save calls PATCH /api/session-notes/:id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockNote, version: 2 } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /save/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/session-notes/note-001'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('clicking Finalize calls POST /api/session-notes/:id/finalize and navigates', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockNote, status: 'FINALIZED' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /finalize/i }));
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/session-notes');
    });
  });

  it('shows error when load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when save returns success=false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /save/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });

  it('shows error when save throws', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /save/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });

  it('shows error when finalize returns success=false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Conflict', code: 'CONFLICT' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /finalize/i }));
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));
    await waitFor(() => {
      expect(screen.getByText(/conflict/i)).toBeInTheDocument();
    });
  });

  it('allows editing all SOAP textarea fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByLabelText(/objective/i));
    fireEvent.change(screen.getByLabelText(/objective/i), {
      target: { value: 'Updated objective.' },
    });
    fireEvent.change(screen.getByLabelText(/assessment/i), {
      target: { value: 'Updated assessment.' },
    });
    fireEvent.change(screen.getByLabelText(/plan/i), { target: { value: 'Updated plan.' } });
    expect(screen.getByDisplayValue('Updated objective.')).toBeInTheDocument();
  });

  it('does not show version section when no versions exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByLabelText(/subjective/i));
    expect(screen.queryByText(/version history/i)).not.toBeInTheDocument();
  });

  it('loads note with null SOAP fields without error', async () => {
    const nullNote = {
      ...mockNote,
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: nullNote }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/subjective/i)).toBeInTheDocument();
    });
    expect((screen.getByLabelText(/subjective/i) as HTMLTextAreaElement).value).toBe('');
  });

  it('shows fallback error message when save error has no message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /save/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });

  it('shows fallback error message when finalize error has no message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /finalize/i }));
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to finalize/i)).toBeInTheDocument();
    });
  });

  it('shows "(empty)" for empty finalized note fields', async () => {
    const emptyNote = {
      ...mockNote,
      status: 'FINALIZED',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: emptyNote }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getAllByText('(empty)').length).toBeGreaterThan(0);
    });
  });

  it('shows error when note API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: { message: 'Not found', code: 'NOT_FOUND' },
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('shows error when finalize throws network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /finalize/i }));
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to finalize/i)).toBeInTheDocument();
    });
  });

  it('clicking Back navigates to /session-notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes');
  });

  it('shows read-only view for finalized notes with no edit buttons', async () => {
    const finalizedNote = { ...mockNote, status: 'FINALIZED' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: finalizedNote }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVersionsResponse }),
    );
    render(<SessionNoteEditPage />);
    await waitFor(() => screen.getByText(/patient reports improvement/i));
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /finalize/i })).not.toBeInTheDocument();
  });
});
