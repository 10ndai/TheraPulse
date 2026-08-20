import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../../../src/app/api/auth/refresh/route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';

const mockCookies = vi.mocked(cookies);

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no refresh_token cookie exists', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);

    const response = await POST();
    expect(response.status).toBe(401);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sets new access/refresh cookies when token is valid', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'valid-refresh-token' }),
    } as never);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { accessToken: 'new-at', refreshToken: 'new-rt' },
        }),
      }),
    );

    const response = await POST();
    expect(response.status).toBe(200);

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toContain('access_token=new-at');
    expect(setCookieHeader).toContain('refresh_token=new-rt');
    expect(setCookieHeader).toContain('HttpOnly');
  });

  it('returns 401 when NestJS rejects the refresh token', async () => {
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
          error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired' },
        }),
      }),
    );

    const response = await POST();
    expect(response.status).toBe(401);
  });

  it('returns 500 on network error', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'token' }),
    } as never);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));

    const response = await POST();
    expect(response.status).toBe(500);
  });
});
