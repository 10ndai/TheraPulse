'use client';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({}),
}));

import ClientDashboardPage from '../../../src/app/worksheet-assignments/page';

const makeAssignment = (id: string, status: string, title: string) => ({
  id,
  status,
  instructions: null,
  dueDate: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  templateId: `tpl-${id}`,
  therapistId: 'therapist-001',
  clientId: 'client-001',
  template: { id: `tpl-${id}`, title, type: 'ASSESSMENT' },
});

const mockAssignments = [
  makeAssignment('a1', 'PENDING', 'PHQ-9 Depression Screen'),
  makeAssignment('a2', 'IN_PROGRESS', 'GAD-7 Anxiety'),
  makeAssignment('a3', 'COMPLETED', 'Daily Mood Tracker'),
  makeAssignment('a4', 'PENDING', 'CBT Thought Record'),
];

const mockResponse = {
  success: true,
  data: mockAssignments,
  meta: { total: 4, page: 1, limit: 20, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Client dashboard — assigned worksheets', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<ClientDashboardPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders assignments grouped by status tabs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    expect(screen.getByRole('tab', { name: /to do/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /completed/i })).toBeInTheDocument();
  });

  it('shows pending assignments in the "To Do" tab', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    expect(screen.getByText('PHQ-9 Depression Screen')).toBeInTheDocument();
    expect(screen.getByText('CBT Thought Record')).toBeInTheDocument();
  });

  it('clicking "In Progress" tab shows in-progress assignments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByRole('tab', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('tab', { name: /in progress/i }));
    await waitFor(() => {
      expect(screen.getByText('GAD-7 Anxiety')).toBeInTheDocument();
    });
  });

  it('clicking "Completed" tab shows completed assignments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByRole('tab', { name: /completed/i }));
    fireEvent.click(screen.getByRole('tab', { name: /completed/i }));
    await waitFor(() => {
      expect(screen.getByText('Daily Mood Tracker')).toBeInTheDocument();
    });
  });

  it('shows empty state message when a tab has no assignments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [makeAssignment('a1', 'PENDING', 'PHQ-9')],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByRole('tab', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('tab', { name: /in progress/i }));
    await waitFor(() => {
      expect(screen.getByText(/no worksheets/i)).toBeInTheDocument();
    });
  });

  it('each assignment card has a "Start" button when PENDING', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    const startButtons = screen.getAllByRole('button', { name: /start/i });
    expect(startButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('each assignment card has a "Continue" button when IN_PROGRESS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByRole('tab', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('tab', { name: /in progress/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ClientDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows due date when assignment has one', async () => {
    const withDue = makeAssignment('a5', 'PENDING', 'PHQ-9 with due');
    const responseWithDue = {
      success: true,
      data: [{ ...withDue, dueDate: '2026-06-01T00:00:00Z' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => responseWithDue,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/^due:/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false during load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('clicking Start button navigates to submit page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );
    render(<ClientDashboardPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    fireEvent.click(screen.getAllByRole('button', { name: /start/i })[0]);
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('/worksheet-assignments/'));
  });
});
