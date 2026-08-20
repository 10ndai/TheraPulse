import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'note-001' }),
}));

import SessionSummaryPage from '../../../src/app/session-notes/[id]/summary/page';

const mockNote = {
  id: 'note-001',
  therapistId: 'therapist-001',
  clientId: 'client-001',
  sessionDate: '2026-03-01',
  sessionType: 'individual',
  subjective: 'Patient reports improvement.',
  objective: 'Alert and oriented.',
  assessment: 'Moderate depression.',
  plan: 'Continue CBT. Practice mindfulness daily.',
  status: 'FINALIZED',
  version: 2,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  deletedAt: null,
};

const mockResponse = { success: true, data: mockNote };

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Session summary page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SessionSummaryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the plan field as "What to work on next"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/what to work on next/i)).toBeInTheDocument();
      expect(screen.getByText(/continue cbt/i)).toBeInTheDocument();
    });
  });

  it('shows the assessment field as "Therapist notes for you"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/therapist notes for you/i)).toBeInTheDocument();
      expect(screen.getByText(/moderate depression/i)).toBeInTheDocument();
    });
  });

  it('does NOT show subjective or objective fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => screen.getByText(/what to work on next/i));
    expect(screen.queryByText(/subjective/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/objective/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/patient reports improvement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert and oriented/i)).not.toBeInTheDocument();
  });

  it('shows session date and type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText('2026-03-01')).toBeInTheDocument();
      expect(screen.getByText(/individual/i)).toBeInTheDocument();
    });
  });

  it('shows "(nothing shared)" when plan is empty', async () => {
    const emptyNote = { ...mockNote, plan: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: emptyNote }),
      }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/nothing shared/i)).toBeInTheDocument();
    });
  });

  it('shows "(nothing shared)" when assessment is empty', async () => {
    const emptyNote = { ...mockNote, assessment: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: emptyNote }),
      }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/nothing shared/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Not found' } }),
      }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('clicking Back navigates to /session-notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(pushMock).toHaveBeenCalledWith('/session-notes');
  });

  it('shows error when API returns success=false without message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) }),
    );
    render(<SessionSummaryPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
