'use client';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({}),
}));

import WorksheetLibraryPage from '../../../src/app/worksheet-templates/page';

const mockTemplates = [
  {
    id: 'tpl-001',
    title: 'PHQ-9 Depression Screen',
    type: 'ASSESSMENT',
    isPublished: true,
    isSystem: true,
    version: 1,
    formSchema: {
      version: 1,
      fields: [{ id: 'f1', type: 'likert', label: 'Q1', required: true, options: [] }],
    },
    createdById: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl-002',
    title: 'GAD-7 Anxiety Screen',
    type: 'ASSESSMENT',
    isPublished: true,
    isSystem: true,
    version: 1,
    formSchema: { version: 1, fields: [] },
    createdById: 'system',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'tpl-003',
    title: 'My CBT Worksheet',
    type: 'CUSTOM',
    isPublished: false,
    isSystem: false,
    version: 1,
    formSchema: { version: 1, fields: [] },
    createdById: 'therapist-uuid',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

const mockListResponse = {
  success: true,
  data: mockTemplates,
  meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Worksheet library page', () => {
  it('shows loading spinner while fetching templates', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<WorksheetLibraryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a list of templates after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('PHQ-9 Depression Screen')).toBeInTheDocument();
      expect(screen.getByText('GAD-7 Anxiety Screen')).toBeInTheDocument();
      expect(screen.getByText('My CBT Worksheet')).toBeInTheDocument();
    });
  });

  it('shows empty state when no templates match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/no templates found/i)).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<WorksheetLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('renders type filter buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assessment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('clicking a type filter refetches with type param', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    fireEvent.click(screen.getByRole('button', { name: /assessment/i }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
      expect(urls.some((u: string) => u.includes('type=ASSESSMENT'))).toBe(true);
    });
  });

  it('shows published badge on published templates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    const badges = screen.getAllByText(/published/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('each template card has a "Use Template" button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    const useButtons = screen.getAllByRole('button', { name: /use template/i });
    expect(useButtons.length).toBe(3);
  });

  it('each template card has a "Preview" button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));
    const previewButtons = screen.getAllByRole('button', { name: /preview/i });
    expect(previewButtons.length).toBe(3);
  });

  it('clicking "Preview" opens a preview dialog for that template', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    const previewButtons = screen.getAllByRole('button', { name: /preview/i });
    fireEvent.click(previewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveTextContent('PHQ-9 Depression Screen');
    });
  });

  it('clicking "Use Template" navigates to the builder for that template', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    const useButtons = screen.getAllByRole('button', { name: /use template/i });
    fireEvent.click(useButtons[0]);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/worksheet-templates/tpl-001/edit');
    });
  });

  it('closing the preview dialog removes it from the DOM', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockListResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    fireEvent.click(screen.getAllByRole('button', { name: /preview/i })[0]);
    await waitFor(() => screen.getByRole('dialog'));

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('preview dialog shows "no fields" message for template with empty fields', async () => {
    const emptyFieldsResponse = {
      success: true,
      data: [{ ...mockTemplates[1], formSchema: { version: 1, fields: [] } }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => emptyFieldsResponse,
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('GAD-7 Anxiety Screen'));

    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/no fields to preview/i);
    });
  });

  it('preview renders label, textarea, rating, and text field types', async () => {
    const richTemplate = {
      ...mockTemplates[0],
      formSchema: {
        version: 1,
        fields: [
          { id: 'f1', type: 'label', label: 'Instructions', content: 'Complete this form.' },
          { id: 'f2', type: 'textarea', label: 'Describe your mood', required: false },
          { id: 'f3', type: 'rating', label: 'Pain level', required: false, min: 0, max: 5 },
          { id: 'f4', type: 'text', label: 'Your name', required: false },
          {
            id: 'f5',
            type: 'likert',
            label: 'Frequency',
            required: true,
            options: [
              { value: 0, label: 'Never' },
              { value: 1, label: 'Always' },
            ],
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [richTemplate],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Instructions');
      expect(dialog).toHaveTextContent('Complete this form.');
      expect(dialog).toHaveTextContent('Describe your mood');
      expect(dialog).toHaveTextContent('Pain level');
      expect(dialog).toHaveTextContent('Your name');
      expect(dialog).toHaveTextContent('Frequency');
      expect(dialog).toHaveTextContent('Never');
    });
  });

  it('clicking Next page button refetches with incremented page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockTemplates,
        meta: { total: 40, page: 1, limit: 20, totalPages: 2 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
      expect(urls.some((u: string) => u.includes('page=2'))).toBe(true);
    });
  });

  it('shows pagination controls when there are multiple pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTemplates,
          meta: { total: 40, page: 1, limit: 20, totalPages: 2 },
        }),
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('Previous page button is disabled on page 1 and enabled after going to page 2', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockTemplates,
        meta: { total: 40, page: 1, limit: 20, totalPages: 2 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetLibraryPage />);
    await waitFor(() => screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
      expect(urls.some((u: string) => u.includes('page=1'))).toBe(true);
    });
  });

  it('shows API error when load returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
      }),
    );
    render(<WorksheetLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });
});
