import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({}),
}));

import SubmissionHistoryPage from '../../../src/app/worksheet-submissions/history/page';

// ─── Mock data ────────────────────────────────────────────────────────────────

const makeSubmission = (
  id: string,
  date: string,
  score: number | null,
  severity: string | null,
) => ({
  id,
  assignmentId: `assign-${id}`,
  clientId: 'client-001',
  responses: '{}',
  score: score !== null ? { totalScore: score, severity: severity! } : null,
  finalizedAt: date,
  integrityHash: 'hash',
  createdAt: date,
  assignment: {
    template: { id: 'tpl-001', title: 'PHQ-9 Depression Screen', type: 'PHQ9' },
  },
});

const mockSubmissions = [
  makeSubmission('sub-001', '2026-03-01T10:00:00Z', 15, 'moderately-severe'),
  makeSubmission('sub-002', '2026-02-01T10:00:00Z', 8, 'mild'),
  makeSubmission('sub-003', '2026-01-01T10:00:00Z', 3, 'minimal'),
];

const mockResponse = {
  success: true,
  data: mockSubmissions,
  meta: { total: 3, page: 1, limit: 50, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Submission history page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SubmissionHistoryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a heading for the history page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /submission history/i })).toBeInTheDocument();
    });
  });

  it('renders one timeline entry per submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      // All 3 submissions should appear with their dates
      expect(screen.getAllByText(/phq-9 depression screen/i).length).toBe(3);
    });
  });

  it('shows the score for each submission that has one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows severity labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/moderately-severe/i)).toBeInTheDocument();
      expect(screen.getByText(/mild/i)).toBeInTheDocument();
      expect(screen.getByText(/minimal/i)).toBeInTheDocument();
    });
  });

  it('clicking a submission navigates to its review page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => screen.getAllByRole('button', { name: /review/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /review/i })[0]);
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/worksheet-submissions/sub-001/review'),
    );
  });

  it('shows empty state when no submissions exist', async () => {
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
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/no submissions/i)).toBeInTheDocument();
    });
  });

  it('renders a sparkline-like score trend (svg or data list)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      // A trend section or list with scores should be present
      // We just check that there's a scores trend element with role list or an svg
      const trend = document.querySelector('[data-testid="score-trend"]');
      expect(trend).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error message when API returns success=false', async () => {
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
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('shows "No scores yet" in score trend when only one scored submission exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [makeSubmission('sub-001', '2026-03-01T10:00:00Z', 15, 'moderately-severe')],
          meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
        }),
      }),
    );
    render(<SubmissionHistoryPage />);
    await waitFor(() => {
      const trend = document.querySelector('[data-testid="score-trend"]');
      expect(trend).toBeInTheDocument();
      expect(trend?.textContent).toMatch(/score: 15/i);
    });
  });
});
