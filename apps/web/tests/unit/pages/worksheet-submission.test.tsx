import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'assign-001' }),
}));

import WorksheetSubmitPage from '../../../src/app/worksheet-assignments/[id]/submit/page';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockAssignment = {
  id: 'assign-001',
  status: 'PENDING',
  instructions: 'Please complete honestly.',
  dueDate: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  templateId: 'tpl-001',
  therapistId: 'therapist-001',
  clientId: 'client-001',
  template: {
    id: 'tpl-001',
    title: 'PHQ-9 Depression Screen',
    type: 'ASSESSMENT',
    formSchema: {
      version: 1,
      fields: [
        {
          id: 'f1',
          type: 'label',
          label: 'Section Header',
          content: 'Over the last 2 weeks',
          required: false,
        },
        {
          id: 'f2',
          type: 'likert',
          label: 'Little interest or pleasure',
          required: true,
          options: [
            { value: '0', label: 'Not at all' },
            { value: '1', label: 'Several days' },
            { value: '2', label: 'More than half the days' },
            { value: '3', label: 'Nearly every day' },
          ],
        },
        { id: 'f3', type: 'textarea', label: 'Additional comments', required: false },
        { id: 'f4', type: 'rating', label: 'Overall severity', required: false, min: 0, max: 10 },
        {
          id: 'f5',
          type: 'select',
          label: 'Mood today',
          required: false,
          options: [
            { value: 'good', label: 'Good' },
            { value: 'okay', label: 'Okay' },
            { value: 'bad', label: 'Bad' },
          ],
        },
        { id: 'f6', type: 'checkbox', label: 'I agree to share results', required: false },
        { id: 'f7', type: 'text', label: 'Your name', required: false },
        { id: 'f8', type: 'number', label: 'Hours of sleep', required: false },
        { id: 'f9', type: 'date', label: 'Last therapy session', required: false },
      ],
    },
  },
};

const mockAssignmentResponse = { success: true, data: mockAssignment };

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Worksheet submission page', () => {
  it('shows loading spinner while fetching assignment', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<WorksheetSubmitPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the template title after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText('PHQ-9 Depression Screen')).toBeInTheDocument();
    });
  });

  it('renders therapist instructions when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText('Please complete honestly.')).toBeInTheDocument();
    });
  });

  it('renders a label field as a heading/text element', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText('Over the last 2 weeks')).toBeInTheDocument();
    });
  });

  it('renders a likert field with radio options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText('Little interest or pleasure')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /not at all/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /several days/i })).toBeInTheDocument();
    });
  });

  it('renders a textarea field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /additional comments/i })).toBeInTheDocument();
    });
  });

  it('renders a rating field with number inputs or buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText('Overall severity')).toBeInTheDocument();
    });
  });

  it('renders a select field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /mood today/i })).toBeInTheDocument();
    });
  });

  it('renders a checkbox field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /i agree to share results/i }),
      ).toBeInTheDocument();
    });
  });

  it('renders a text field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    });
  });

  it('renders a number field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/hours of sleep/i)).toBeInTheDocument();
    });
  });

  it('renders a date field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/last therapy session/i)).toBeInTheDocument();
    });
  });

  it('shows a Submit button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });

  it('auto-saves after input change with a debounce delay', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 'sub-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    // Use fake timers only for this test
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<WorksheetSubmitPage />);
      await waitFor(() => screen.getByRole('textbox', { name: /additional comments/i }));

      fireEvent.change(screen.getByRole('textbox', { name: /additional comments/i }), {
        target: { value: 'I feel fine.' },
      });

      // before debounce fires, no auto-save call yet
      expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial load

      // advance timers past debounce
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const autoSaveCall = calls.find(
          (args) =>
            (args[0] as string).includes('worksheet-submissions') &&
            (args[1] as RequestInit)?.method === 'POST',
        );
        expect(autoSaveCall).toBeDefined();
        const body = JSON.parse((autoSaveCall![1] as RequestInit).body as string) as {
          status: string;
        };
        expect(body.status).toBe('DRAFT');
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('submitting the form calls POST /api/worksheet-submissions with status SUBMITTED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 'sub-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const submitCall = calls.find(
        (args) =>
          (args[0] as string).includes('worksheet-submissions') &&
          (args[1] as RequestInit)?.method === 'POST',
      );
      expect(submitCall).toBeDefined();
      const body = JSON.parse((submitCall![1] as RequestInit).body as string) as {
        status: string;
        assignmentId: string;
      };
      expect(body.status).toBe('SUBMITTED');
      expect(body.assignmentId).toBe('assign-001');
    });
  });

  it('navigates back to /worksheet-assignments after successful submit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 'sub-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/worksheet-assignments');
    });
  });

  it('shows error message when load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false during load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Assignment not found' } }),
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => {
      expect(screen.getByText(/assignment not found/i)).toBeInTheDocument();
    });
  });

  it('shows submit error when submission fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows submit error when API returns success=false on submit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Already submitted' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/already submitted/i)).toBeInTheDocument();
    });
  });

  it('response values are included in submission body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssignmentResponse })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 'sub-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('textbox', { name: /additional comments/i }));

    fireEvent.change(screen.getByRole('textbox', { name: /additional comments/i }), {
      target: { value: 'Feeling better.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      const submitCall = fetchMock.mock.calls.find((args) => {
        const url = args[0] as string;
        const opts = args[1] as RequestInit;
        if (!url.includes('worksheet-submissions') || opts?.method !== 'POST') return false;
        const parsed = JSON.parse(opts.body as string) as { status: string };
        return parsed.status === 'SUBMITTED';
      });
      expect(submitCall).toBeDefined();
      const body = JSON.parse((submitCall![1] as RequestInit).body as string) as {
        responses: unknown;
      };
      expect(body.responses).toBeDefined();
    });
  });

  it('user can interact with all field types (rating, select, checkbox, text, number, date)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByText('PHQ-9 Depression Screen'));

    // rating — click button "5"
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // select — change Mood today
    fireEvent.change(screen.getByRole('combobox', { name: /mood today/i }), {
      target: { value: 'good' },
    });

    // checkbox — toggle
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to share results/i }));

    // text — type in Your name
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Jane' },
    });

    // number — type in Hours of sleep
    fireEvent.change(screen.getByLabelText(/hours of sleep/i), {
      target: { value: '8' },
    });

    // date — pick a date
    fireEvent.change(screen.getByLabelText(/last therapy session/i), {
      target: { value: '2026-01-15' },
    });

    // All interactions completed without throwing
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows a Cancel / Back button that navigates to assignments list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignmentResponse,
      }),
    );
    render(<WorksheetSubmitPage />);
    await waitFor(() => screen.getByRole('button', { name: /cancel|back/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel|back/i }));
    expect(pushMock).toHaveBeenCalledWith('/worksheet-assignments');
  });
});
