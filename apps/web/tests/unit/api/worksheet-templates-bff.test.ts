import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { GET, PATCH } from '../../../src/app/api/worksheet-templates/[id]/route';
import { POST as postPublish } from '../../../src/app/api/worksheet-templates/[id]/publish/route';
import { POST as postCreate, GET as getList } from '../../../src/app/api/worksheet-templates/route';

const mockCookies = (token: string | null) => {
  vi.mocked(cookies).mockReturnValue({
    get: (name: string) => (name === 'access_token' && token ? { name, value: token } : undefined),
  } as ReturnType<typeof cookies>);
};

const TEMPLATE_ID = '10000000-0000-0000-0000-000000000001';

describe('GET /api/worksheet-templates/[id]', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}`);
    const res = await GET(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('forwards GET to NestJS with Authorization header', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }),
    );
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}`);
    await GET(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`/worksheet-templates/${TEMPLATE_ID}`),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
      }),
    );
  });

  it('returns 500 on fetch error', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')));
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}`);
    const res = await GET(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/worksheet-templates/[id]', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('forwards PATCH body to NestJS', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }),
    );
    const body = { title: 'Updated Title', formSchema: { version: 1, fields: [] } };
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    await PATCH(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`/worksheet-templates/${TEMPLATE_ID}`),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('POST /api/worksheet-templates/[id]/publish', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}/publish`, {
      method: 'POST',
    });
    const res = await postPublish(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('calls NestJS POST /worksheet-templates/:id/publish', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }),
    );
    const req = new NextRequest(`http://localhost/api/worksheet-templates/${TEMPLATE_ID}/publish`, {
      method: 'POST',
    });
    await postPublish(req, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(`/worksheet-templates/${TEMPLATE_ID}/publish`);
  });
});

describe('POST /api/worksheet-templates', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest('http://localhost/api/worksheet-templates', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await postCreate(req);
    expect(res.status).toBe(401);
  });

  it('forwards POST to NestJS with body', async () => {
    mockCookies('tok-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({ success: true, data: { id: 'new-uuid' } }),
      }),
    );
    const body = { title: 'New Template', type: 'CUSTOM', formSchema: { version: 1 } };
    const req = new NextRequest('http://localhost/api/worksheet-templates', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const res = await postCreate(req);
    expect(res.status).toBe(201);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/worksheet-templates'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('GET /api/worksheet-templates', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 401 when no access_token cookie', async () => {
    mockCookies(null);
    const req = new NextRequest('http://localhost/api/worksheet-templates');
    const res = await getList(req);
    expect(res.status).toBe(401);
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
    const req = new NextRequest(
      'http://localhost/api/worksheet-templates?type=CUSTOM&isPublished=false',
    );
    await getList(req);
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('type=CUSTOM');
  });
});
