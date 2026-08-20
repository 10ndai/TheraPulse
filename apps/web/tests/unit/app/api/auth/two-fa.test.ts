import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../../../src/app/api/auth/2fa/route';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: 'THERAPIST',
  status: 'ACTIVE',
};

describe('POST /api/auth/2fa', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets httpOnly cookies and returns user on valid TOTP token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { accessToken: 'at-2fa', refreshToken: 'rt-2fa', user: mockUser },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ userId: mockUser.id, token: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toContain('access_token=at-2fa');
    expect(setCookieHeader).toContain('refresh_token=rt-2fa');
    expect(setCookieHeader).toContain('HttpOnly');

    const body = (await response.json()) as { success: boolean; data: { user: typeof mockUser } };
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('therapist@example.com');

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0] as string).toContain('/auth/2fa/verify');
  });

  it('returns 401 on invalid TOTP token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ userId: mockUser.id, token: '000000' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 500 on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));

    const req = new NextRequest('http://localhost/api/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ userId: 'uid', token: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
  });
});
