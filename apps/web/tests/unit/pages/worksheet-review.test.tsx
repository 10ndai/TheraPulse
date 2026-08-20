import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'sub-001' }),
}));

import WorksheetReviewPage from '../../../src/app/worksheet-submissions/[id]/review/page';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockSubmission = {
  id: 'sub-001',
  assignmentId: 'assign-001',
  clientId: 'client-001',
  responses: JSON.stringify({
    phq1: '2',
    phq2: '3',
    comments: 'Feeling anxious lately.',
  }),
  score: { totalScore: 12, severity: 'moderate' },
  finalizedAt: '2026-01-15T10:30:00Z',
  integrityHash: 'hash-abc',
  createdAt: '2026-01-15T09:00:00Z',
  assignment: {
    id: 'assign-001',
    therapistId: 'therapist-001',
    clientId: 'client-001',
    instructions: 'Complete when feeling down.',
    dueDate: '2026-01-20T00:00:00Z',
    template: {
      id: 'tpl-001',
      title: 'PHQ-9 Depression Screen',
      type: 'PHQ9',
      formSchema: {
        version: 1,
        fields: [
          {
            id: 'phq1',
            type: 'likert',
            label: 'Little interest or pleasure',
            required: true,
            scoringKey: 'phq1',
            options: [
              { value: '0', label: 'Not at all' },
              { value: '1', label: 'Several days' },
              { value: '2', label: 'More than half the days' },
              { value: '3', label: 'Nearly every day' },
            ],
          },
          {
            id: 'phq2',
            type: 'likert',
            label: 'Feeling down or hopeless',
            required: true,
            scoringKey: 'phq2',
            options: [
              { value: '0', label: 'Not at all' },
              { value: '1', label: 'Several days' },
              { value: '2', label: 'More than half the days' },
              { value: '3', label: 'Nearly every day' },
            ],
          },
          { id: 'comments', type: 'textarea', label: 'Additional comments', required: false },
        ],
      },
    },
  },
};

const mockResponse = { success: true, data: mockSubmission };

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Worksheet review page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<WorksheetReviewPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the template title after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText('PHQ-9 Depression Screen')).toBeInTheDocument();
    });
  });

  it('shows the finalized date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/submitted/i)).toBeInTheDocument();
    });
  });

  it('displays score and severity when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/12/)).toBeInTheDocument();
      expect(screen.getByText(/moderate/i)).toBeInTheDocument();
    });
  });

  it('renders each form field label in read-only mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText('Little interest or pleasure')).toBeInTheDocument();
      expect(screen.getByText('Feeling down or hopeless')).toBeInTheDocument();
      expect(screen.getByText('Additional comments')).toBeInTheDocument();
    });
  });

  it('shows the client response for likert fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      // phq1 response is '2' → "More than half the days"
      expect(screen.getByText('More than half the days')).toBeInTheDocument();
    });
  });

  it('shows the client response for textarea fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText('Feeling anxious lately.')).toBeInTheDocument();
    });
  });

  it('shows "(no response)" for unanswered fields', async () => {
    const subWithMissingField = {
      ...mockSubmission,
      responses: JSON.stringify({ phq1: '1' }), // phq2 and comments missing
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: subWithMissingField }),
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/no response/i).length).toBeGreaterThan(0);
    });
  });

  it('shows no score section when score is null', async () => {
    const subNoScore = { ...mockSubmission, score: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: subNoScore }),
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    expect(screen.queryByText(/total score/i)).not.toBeInTheDocument();
  });

  it('shows error when load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Not found' } }),
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('has a Back button that navigates to submissions list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(pushMock).toHaveBeenCalledWith('/worksheet-submissions');
  });

  it('shows "Verified" badge when integrity check passes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { valid: true } }),
        }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/verified/i)).toBeInTheDocument();
    });
  });

  it('shows "Tampered" badge when integrity check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { valid: false } }),
        }),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/tampered/i)).toBeInTheDocument();
    });
  });

  it('does not crash when integrity verify call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse })
        .mockRejectedValueOnce(new Error('Network error')),
    );
    render(<WorksheetReviewPage />);
    await waitFor(() => {
      expect(screen.getByText('PHQ-9 Depression Screen')).toBeInTheDocument();
    });
    // no badge shown — no crash
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tampered/i)).not.toBeInTheDocument();
  });
});
