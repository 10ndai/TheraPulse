import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../../../src/app/api/auth/logout/route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';

const mockCookies = vi.mocked(cookies);

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clears access_token and refresh_token cookies and returns 200', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'some-token' }),
    } as never);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      }),
    );

    const response = await POST();
    expect(response.status).toBe(200);

    // Both cookies should be cleared (max-age=0 or expires in the past)
    const setCookieHeaders =
      response.headers.getSetCookie?.() ?? response.headers.get('set-cookie') ?? '';
    const cookieStr = Array.isArray(setCookieHeaders)
      ? setCookieHeaders.join('; ')
      : setCookieHeaders;
    expect(cookieStr).toContain('access_token=');
    expect(cookieStr).toContain('refresh_token=');
  });

  it('still clears cookies even when no token cookie exists', async () => {
    mockCookies.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);

    const response = await POST();
    expect(response.status).toBe(200);
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
