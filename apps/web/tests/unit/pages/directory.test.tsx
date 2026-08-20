import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import DirectoryPage from '../../../src/app/directory/page';

const makeTherapist = (id: string, name: string) => ({
  id,
  name,
  bio: `Bio for ${name}`,
  specializations: ['Anxiety'],
  languages: ['English'],
  city: 'Harare',
  province: null,
});

const mockPagedResponse = {
  success: true,
  data: [makeTherapist('tp-1', 'Dr. Alice'), makeTherapist('tp-2', 'Dr. Bob')],
  meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
};

describe('Directory page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
  });

  it('renders search form with name, city, and specialization fields', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPagedResponse,
      }),
    );
    render(<DirectoryPage />);
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/city/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/specialization/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('shows a loading spinner while fetching', async () => {
    // Never resolves so spinner stays visible
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('renders therapist cards after successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPagedResponse,
      }),
    );
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Dr. Alice/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Dr. Bob/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when no therapists are found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
        }),
      }),
    );
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/no therapists found/i)).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('submitting the search form calls the BFF with correct params', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockPagedResponse })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockPagedResponse });
    vi.stubGlobal('fetch', fetchMock);

    render(<DirectoryPage />);
    await waitFor(() => screen.getByRole('heading', { name: /Dr. Alice/i }));

    await userEvent.type(screen.getByPlaceholderText(/name/i), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('name=Alice');
    });
  });

  it('shows next-page button when there are multiple pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [makeTherapist('tp-1', 'Dr. Alice')],
          meta: { page: 1, limit: 12, total: 25, totalPages: 3 },
        }),
      }),
    );
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('previous-page button is disabled on page 1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [makeTherapist('tp-1', 'Dr. Alice')],
          meta: { page: 1, limit: 12, total: 25, totalPages: 3 },
        }),
      }),
    );
    render(<DirectoryPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });

  it('clicking next page fetches page 2', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [makeTherapist('tp-1', 'Dr. Alice')],
        meta: { page: 1, limit: 12, total: 25, totalPages: 3 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DirectoryPage />);
    await waitFor(() => screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('page=2');
    });
  });

  it('renders page heading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPagedResponse,
      }),
    );
    render(<DirectoryPage />);
    expect(screen.getByRole('heading', { name: /find a therapist/i })).toBeInTheDocument();
  });
});
