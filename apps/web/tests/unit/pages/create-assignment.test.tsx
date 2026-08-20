'use client';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({}),
}));

import CreateAssignmentPage from '../../../src/app/worksheet-assignments/new/page';

const mockTemplates = [
  {
    id: 'tpl-001',
    title: 'PHQ-9',
    type: 'ASSESSMENT',
    isPublished: true,
    version: 1,
    formSchema: { version: 1, fields: [] },
    isSystem: true,
    createdById: 'sys',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tpl-002',
    title: 'GAD-7',
    type: 'ASSESSMENT',
    isPublished: true,
    version: 1,
    formSchema: { version: 1, fields: [] },
    isSystem: true,
    createdById: 'sys',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const mockClients = [
  { id: 'client-001', name: 'Alice Dube', email: 'alice@example.com' },
  { id: 'client-002', name: 'Bob Ncube', email: 'bob@example.com' },
];

const mockTemplatesResponse = {
  success: true,
  data: mockTemplates,
  meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
};

const mockClientsResponse = {
  success: true,
  data: mockClients,
  meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Create assignment page', () => {
  it('shows loading spinner while fetching templates and clients', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<CreateAssignmentPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a template selector and client selector after loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /client/i })).toBeInTheDocument();
    });
  });

  it('populates template dropdown with fetched templates', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));
    expect(screen.getByRole('option', { name: /phq-9/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /gad-7/i })).toBeInTheDocument();
  });

  it('populates client dropdown with fetched clients', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /client/i }));
    expect(screen.getByRole('option', { name: /alice dube/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /bob ncube/i })).toBeInTheDocument();
  });

  it('renders instructions textarea and due date input', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));
    expect(screen.getByRole('textbox', { name: /instructions/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
  });

  it('submit button is disabled until template and client are selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('button', { name: /assign/i }));
    expect(screen.getByRole('button', { name: /assign/i })).toBeDisabled();
  });

  it('submit button becomes enabled after selecting template and client', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });

    expect(screen.getByRole('button', { name: /assign/i })).not.toBeDisabled();
  });

  it('submitting the form calls POST /api/worksheet-assignments', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'assign-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const postCall = calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes('worksheet-assignments') && opts?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body as string)).toMatchObject({
        templateId: 'tpl-001',
        clientId: 'client-001',
      });
    });
  });

  it('navigates to assignments list after successful submission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'assign-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/worksheet-assignments');
    });
  });

  it('shows error when submission fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false on submit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: { message: 'Client not found' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      expect(screen.getByText(/client not found/i)).toBeInTheDocument();
    });
  });

  it('typing instructions and due date sends them in POST body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'a-001' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('combobox', { name: /template/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /client/i }), {
      target: { value: 'client-001' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /instructions/i }), {
      target: { value: 'Complete daily' },
    });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-06-01' } });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes('worksheet-assignments') && opts?.method === 'POST',
      );
      const body = JSON.parse(postCall[1].body as string);
      expect(body.instructions).toBe('Complete daily');
      expect(body.dueDate).toBeDefined();
    });
  });

  it('shows error when load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<CreateAssignmentPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows error when API returns success=false during load', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('Cancel button navigates back to assignments list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplatesResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClientsResponse }),
    );
    render(<CreateAssignmentPage />);
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(pushMock).toHaveBeenCalledWith('/worksheet-assignments');
  });
});
