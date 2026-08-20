import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../../src/app/api/health/route';

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe('GET /api/health (BFF route)', () => {
  it('returns 500 CONFIG_ERROR when API_URL is not set', async () => {
    delete process.env['API_URL'];

    const response = await GET();
    const body = (await response.json()) as { success: boolean; error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFIG_ERROR');
  });

  it('proxies a successful upstream response', async () => {
    process.env['API_URL'] = 'http://localhost:3001';

    const mockBody = { status: 'ok', timestamp: new Date().toISOString() };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        status: 200,
        json: async () => mockBody,
      }),
    );

    const response = await GET();
    const body = (await response.json()) as typeof mockBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('returns 502 UPSTREAM_ERROR when fetch throws', async () => {
    process.env['API_URL'] = 'http://localhost:3001';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')));

    const response = await GET();
    const body = (await response.json()) as { success: boolean; error: { code: string } };

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
  });
});
