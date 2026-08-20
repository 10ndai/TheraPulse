import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next/headers before importing routes
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { GET as getPending } from '../../../src/app/api/admin/therapists/pending/route';
import { PATCH as approveTherapist } from '../../../src/app/api/admin/therapists/[id]/approve/route';
import { PATCH as rejectTherapist } from '../../../src/app/api/admin/therapists/[id]/reject/route';

const mockCookies = (token: string | null) => {
  vi.mocked(cookies).mockReturnValue({
    get: (name: string) => (name === 'access_token' && token ? { name, value: token } : undefined),
  } as ReturnType<typeof cookies>);
};

describe('GET /api/admin/therapists/pending', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest('http://localhost/api/admin/therapists/pending');
    const res = await getPending(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('forwards request to NestJS with Authorization header', async () => {
    mockCookies('tok-123');
    const mockResponse = {
      success: true,
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => mockResponse,
      }),
    );

    const req = new NextRequest('http://localhost/api/admin/therapists/pending?page=1');
    await getPending(req);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/admin/therapists/pending'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    );
  });

  it('forwards query params to NestJS', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: [], meta: {} }),
      }),
    );

    const req = new NextRequest('http://localhost/api/admin/therapists/pending?page=2&limit=10');
    await getPending(req);

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=10');
  });

  it('returns 500 on fetch error', async () => {
    mockCookies('tok-123');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const req = new NextRequest('http://localhost/api/admin/therapists/pending');
    const res = await getPending(req);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/therapists/[id]/approve', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest('http://localhost/api/admin/therapists/u-1/approve', {
      method: 'PATCH',
    });
    const res = await approveTherapist(req, { params: Promise.resolve({ id: 'u-1' }) });
    expect(res.status).toBe(401);
  });

  it('calls NestJS PATCH /admin/therapists/:id/approve', async () => {
    mockCookies('tok-123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }),
    );

    const req = new NextRequest('http://localhost/api/admin/therapists/u-1/approve', {
      method: 'PATCH',
    });
    await approveTherapist(req, { params: Promise.resolve({ id: 'u-1' }) });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/admin/therapists/u-1/approve');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('PATCH /api/admin/therapists/[id]/reject', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest('http://localhost/api/admin/therapists/u-1/reject', {
      method: 'PATCH',
    });
    const res = await rejectTherapist(req, { params: Promise.resolve({ id: 'u-1' }) });
    expect(res.status).toBe(401);
  });

  it('calls NestJS PATCH /admin/therapists/:id/reject', async () => {
    mockCookies('tok-123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }),
    );

    const req = new NextRequest('http://localhost/api/admin/therapists/u-2/reject', {
      method: 'PATCH',
    });
    await rejectTherapist(req, { params: Promise.resolve({ id: 'u-2' }) });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/admin/therapists/u-2/reject');
  });
});
