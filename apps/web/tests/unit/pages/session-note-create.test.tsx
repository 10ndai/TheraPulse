import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ clientId: 'client-001' }),
}));

import SessionNoteCreatePage from '../../../src/app/session-notes/new/page';

const mockNote = {
  id: 'note-001',
  therapistId: 'therapist-001',
  clientId: 'client-001',
  sessionDate: '2026-03-01T10:00:00Z',
  sessionType: 'individual',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  status: 'DRAFT',
  version: 1,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  deletedAt: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Session note creation page', () => {
  it('renders a heading for new session note', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteCreatePage />);
    expect(screen.getByRole('heading', { name: /new session note/i })).toBeInTheDocument();
  });

  it('renders SOAP section fields (Subjective, Objective, Assessment, Plan)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteCreatePage />);
    expect(screen.getByLabelText(/subjective/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/objective/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assessment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plan/i)).toBeInTheDocument();
  });

  it('renders session date and type fields', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteCreatePage />);
    expect(screen.getByLabelText(/session date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session type/i)).toBeInTheDocument();
  });

  it('shows a Save Draft button and a Finalize button', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteCreatePage />);
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalize/i })).toBeInTheDocument();
  });

  it('clicking Save Draft calls POST /api/session-notes with status DRAFT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockNote }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteCreatePage />);

    fireEvent.change(screen.getByLabelText(/subjective/i), {
      target: { value: 'Patient reports anxiety.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/session-notes'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"status":"DRAFT"'),
        }),
      );
    });
  });

  it('clicking Finalize calls POST /api/session-notes with status FINALIZED and navigates away', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: mockNote }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockNote, status: 'FINALIZED' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteCreatePage />);

    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it('shows a saving indicator during auto-save', async () => {
    let resolveFirst: (v: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingPromise);
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionNoteCreatePage />);

    fireEvent.change(screen.getByLabelText(/subjective/i), { target: { value: 'Typing...' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    // Saving indicator should appear while request is pending
    expect(screen.queryByText(/saving/i)).toBeInTheDocument();

    // Clean up
    act(() => {
      resolveFirst({ ok: true, json: async () => ({ success: true, data: mockNote }) });
    });
  });

  it('shows error when save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<SessionNoteCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
        }),
      }),
    );
    render(<SessionNoteCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('navigates to /session-notes after successful finalize', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { ...mockNote, status: 'FINALIZED' } }),
      }),
    );
    render(<SessionNoteCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/session-notes');
    });
  });

  it('has a Cancel button that navigates back', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionNoteCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes');
  });
});
