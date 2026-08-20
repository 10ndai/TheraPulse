import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/client/timeline',
}));

import ClientTimelinePage from '../../../src/app/dashboard/client/timeline/page';

const mockSubmissions = {
  success: true,
  data: [
    {
      id: 's1',
      worksheetTitle: 'Anxiety Check-In',
      finalizedAt: '2026-03-10T10:00:00Z',
      score: 14,
    },
    { id: 's2', worksheetTitle: 'Mood Tracker', finalizedAt: '2026-03-05T09:00:00Z', score: null },
  ],
};

const mockNotes = {
  success: true,
  data: [
    { id: 'n1', sessionDate: '2026-03-08', status: 'FINALIZED' },
    { id: 'n2', sessionDate: '2026-03-01', status: 'DRAFT' },
  ],
};

function fetchMock(url: string) {
  if (typeof url === 'string' && url.includes('worksheet-submissions')) {
    return Promise.resolve({ ok: true, json: async () => mockSubmissions });
  }
  return Promise.resolve({ ok: true, json: async () => mockNotes });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Client timeline page', () => {
  it('shows loading spinner while fetching', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<ClientTimelinePage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders timeline items after load', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument();
      expect(screen.getByText('Mood Tracker')).toBeInTheDocument();
    });
  });

  it('renders session note entries', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/session/i).length).toBeGreaterThan(0);
    });
  });

  it('sorts items newest first', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => {
      const items = screen.getAllByRole('listitem');
      // First item should be 2026-03-10 (Anxiety Check-In)
      expect(items[0].textContent).toMatch(/anxiety check-in/i);
    });
  });

  it('filters to show only worksheet submissions', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /worksheets/i }));
    expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument();
    expect(screen.queryAllByText(/session/i).filter((el) => el.tagName !== 'BUTTON').length).toBe(
      0,
    );
  });

  it('filters to show only session notes', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /sessions/i }));
    expect(screen.queryByText('Anxiety Check-In')).not.toBeInTheDocument();
  });

  it('shows "all" filter resets view', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /worksheets/i }));
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }));
    expect(screen.getByText('Anxiety Check-In')).toBeInTheDocument();
  });

  it('shows empty state when no items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) })),
    );
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getByText(/no activity/i)).toBeInTheDocument();
    });
  });

  it('shows score when submission has a score', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchMock));
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getByText(/score.*14|14.*score/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Forbidden' } }),
      }),
    );
    render(<ClientTimelinePage />);
    await waitFor(() => {
      expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
    });
  });
});
