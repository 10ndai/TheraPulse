'use client';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'template-uuid-001' }),
}));

import BuilderPage from '../../../src/app/worksheet-templates/[id]/edit/page';

const mockDraftTemplate = {
  id: 'template-uuid-001',
  title: 'My CBT Worksheet',
  type: 'CUSTOM',
  formSchema: {
    version: 1,
    description: '',
    fields: [
      { id: 'f1', type: 'text', label: 'Situation', required: true },
      { id: 'f2', type: 'textarea', label: 'Thoughts', required: false, rows: 4 },
    ],
  },
  scoringConfig: null,
  isSystem: false,
  isPublished: false,
  version: 1,
  createdById: 'therapist-uuid',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Worksheet builder page', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows loading spinner while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<BuilderPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders template title after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('My CBT Worksheet')).toBeInTheDocument();
    });
  });

  it('renders existing fields from template', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Thoughts')).toBeInTheDocument();
    });
  });

  it('renders field type sidebar with available types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add text field/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add textarea/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add likert/i })).toBeInTheDocument();
    });
  });

  it('clicking a field type adds it to the canvas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /add text field/i }));

    fireEvent.click(screen.getByRole('button', { name: /add text field/i }));

    expect(screen.getAllByText(/new text field/i).length).toBeGreaterThan(0);
  });

  it('delete button removes a field from the canvas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByText('Situation'));

    const deleteButtons = screen.getAllByRole('button', { name: /delete field/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Situation')).not.toBeInTheDocument();
    });
  });

  it('move down button reorders fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByText('Situation'));

    const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
    fireEvent.click(moveDownButtons[0]);

    const fieldLabels = screen.getAllByRole('heading', { level: 3 });
    expect(fieldLabels[0]).toHaveTextContent('Thoughts');
    expect(fieldLabels[1]).toHaveTextContent('Situation');
  });

  it('move up button is disabled for the first field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByText('Situation'));

    const moveUpButtons = screen.getAllByRole('button', { name: /move up/i });
    expect(moveUpButtons[0]).toBeDisabled();
  });

  it('save draft button calls PATCH BFF and shows saved confirmation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /save draft/i }));

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const patchCall = calls[calls.length - 1];
      expect((patchCall[1] as RequestInit).method).toBe('PATCH');
    });
  });

  it('publish button calls POST publish BFF', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockDraftTemplate, isPublished: true } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /publish/i }));

    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const publishCall = calls[calls.length - 1];
      expect(publishCall[0] as string).toContain('/publish');
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('preview toggle switches to preview mode showing rendered fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /preview/i }));

    fireEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  it('publish button is disabled when template is already published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { ...mockDraftTemplate, isPublished: true } }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
    });
  });

  it('shows API error when load returns success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Template not found' } }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => {
      expect(screen.getByText(/template not found/i)).toBeInTheDocument();
    });
  });

  it('shows error when save draft fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /save draft/i }));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error when publish returns success=false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Cannot publish' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('move up button reorders fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByText('Situation'));

    const moveUpButtons = screen.getAllByRole('button', { name: /move up/i });
    fireEvent.click(moveUpButtons[1]); // second field (Thoughts) moved up

    const fieldLabels = screen.getAllByRole('heading', { level: 3 });
    expect(fieldLabels[0]).toHaveTextContent('Thoughts');
    expect(fieldLabels[1]).toHaveTextContent('Situation');
  });

  it('deleting all fields shows empty canvas message', async () => {
    const singleFieldTemplate = {
      ...mockDraftTemplate,
      formSchema: {
        version: 1,
        description: '',
        fields: [{ id: 'f1', type: 'text', label: 'Only Field', required: false }],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: singleFieldTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByText('Only Field'));

    const deleteBtn = screen.getByRole('button', { name: /delete field/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/click a field type/i)).toBeInTheDocument();
    });
  });

  it('preview mode with no fields shows empty state message', async () => {
    const emptyTemplate = {
      ...mockDraftTemplate,
      formSchema: { version: 1, description: '', fields: [] },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: emptyTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByText(/no fields to preview/i)).toBeInTheDocument();
    });
  });

  it('preview renders label and likert field types', async () => {
    const template = {
      ...mockDraftTemplate,
      formSchema: {
        version: 1,
        description: '',
        fields: [
          { id: 'l1', type: 'label', label: 'Instructions', content: 'Read carefully.' },
          {
            id: 'l2',
            type: 'likert',
            label: 'How do you feel?',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Sometimes' },
            ],
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: template }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByText('Instructions')).toBeInTheDocument();
      expect(screen.getByText('Read carefully.')).toBeInTheDocument();
      expect(screen.getByText('How do you feel?')).toBeInTheDocument();
      expect(screen.getByText('Not at all')).toBeInTheDocument();
    });
  });

  it('typing in the title input updates the title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('textbox', { name: /template title/i }));

    const titleInput = screen.getByRole('textbox', { name: /template title/i });
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    expect(titleInput).toHaveValue('Updated Title');
  });

  it('shows error when publish fetch throws a network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDraftTemplate }),
      })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('clicking special field type buttons adds them to the canvas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { ...mockDraftTemplate, formSchema: { version: 1, fields: [] } },
        }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /add textarea/i }));

    fireEvent.click(screen.getByRole('button', { name: /add textarea/i }));
    fireEvent.click(screen.getByRole('button', { name: /add rating scale/i }));
    fireEvent.click(screen.getByRole('button', { name: /add select/i }));
    fireEvent.click(screen.getByRole('button', { name: /add label/i }));
    fireEvent.click(screen.getByRole('button', { name: /add likert/i }));

    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings.length).toBeGreaterThanOrEqual(5);
    });
  });

  it('preview renders rating, select, and checkbox field types', async () => {
    const template = {
      ...mockDraftTemplate,
      formSchema: {
        version: 1,
        description: '',
        fields: [
          { id: 'r1', type: 'rating', label: 'Pain level', required: false, min: 0, max: 3 },
          {
            id: 's1',
            type: 'select',
            label: 'Frequency',
            required: false,
            options: [
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ],
          },
          { id: 'c1', type: 'checkbox', label: 'I agree', required: false },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: template }),
      }),
    );
    render(<BuilderPage />);
    await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByText('Pain level')).toBeInTheDocument();
      expect(screen.getByText('Frequency')).toBeInTheDocument();
      expect(screen.getByText('I agree')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
    });
  });
});
