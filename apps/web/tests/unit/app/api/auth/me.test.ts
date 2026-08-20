import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../../../src/app/api/auth/me/route';

// Mock next/headers so we can control the cookie value without a real Next.js runtime
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';

const mockCookies = vi.mocked(cookies);

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: 'THERAPIST',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no access_token cookie exists', async () => {
    mockCookies.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) } as never);

    const response = await GET();
    expect(response.status).toBe(401);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('proxies the access_token to NestJS /auth/me and returns the user', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'valid-access-token' }),
    } as never);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockUser }),
      }),
    );

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as { success: boolean; data: typeof mockUser };
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('therapist@example.com');

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toContain('/auth/me');
    expect((fetchCall[1] as RequestInit | undefined)?.headers).toMatchObject({
      Authorization: 'Bearer valid-access-token',
    });
  });

  it('forwards a 401 from NestJS when token is expired', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'expired-token' }),
    } as never);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
        }),
      }),
    );

    const response = await GET();
    expect(response.status).toBe(401);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
  });

  it('returns 500 when fetch throws a network error', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'some-token' }),
    } as never);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));

    const response = await GET();
    expect(response.status).toBe(500);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
