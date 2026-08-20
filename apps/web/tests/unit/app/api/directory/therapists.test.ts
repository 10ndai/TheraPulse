import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../../../../src/app/api/directory/therapists/route';

const mockTherapists = [
  {
    id: 'tp-001',
    userId: 'u-001',
    name: 'Dr. Amara Moyo',
    bio: 'Specialist in trauma therapy.',
    specializations: ['Trauma', 'Anxiety'],
    qualifications: ['PhD Psychology'],
    languages: ['English', 'Shona'],
    city: 'Harare',
    province: 'Harare',
    approvalStatus: 'APPROVED',
  },
];

const mockPaginatedResponse = {
  success: true,
  data: mockTherapists,
  meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
};

describe('GET /api/directory/therapists', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies query params to NestJS and returns results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPaginatedResponse,
      }),
    );

    const req = new NextRequest(
      'http://localhost/api/directory/therapists?name=Amara&city=Harare&page=1&limit=12',
    );

    const response = await GET(req);
    expect(response.status).toBe(200);

    const body = (await response.json()) as typeof mockPaginatedResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Dr. Amara Moyo');

    // Verify query params were forwarded
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const calledUrl = fetchCall[0] as string;
    expect(calledUrl).toContain('/directory/therapists');
    expect(calledUrl).toContain('name=Amara');
    expect(calledUrl).toContain('city=Harare');
  });

  it('returns empty results when no therapists match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/directory/therapists?name=NoOne');
    const response = await GET(req);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { success: boolean; data: unknown[] };
    expect(body.data).toHaveLength(0);
  });

  it('returns 500 when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')));

    const req = new NextRequest('http://localhost/api/directory/therapists');
    const response = await GET(req);
    expect(response.status).toBe(500);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('works with no query params (returns first page)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPaginatedResponse,
      }),
    );

    const req = new NextRequest('http://localhost/api/directory/therapists');
    const response = await GET(req);
    expect(response.status).toBe(200);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0] as string).toContain('/directory/therapists');
  });
});
