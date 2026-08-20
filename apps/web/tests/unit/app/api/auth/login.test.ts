import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../../../src/app/api/auth/login/route';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: 'THERAPIST',
  status: 'ACTIVE',
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets httpOnly cookies and returns user when 2FA is not required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { accessToken: 'at123', refreshToken: 'rt456', user: mockUser },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'therapist@example.com', password: 'SecurePass1!' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toContain('access_token=at123');
    expect(setCookieHeader).toContain('refresh_token=rt456');
    expect(setCookieHeader).toContain('HttpOnly');

    const body = (await response.json()) as { success: boolean; data: { user: typeof mockUser } };
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('therapist@example.com');
  });

  it('returns requiresTwoFactor:true and userId without setting cookies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { requiresTwoFactor: true, userId: 'user-uuid-123' },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'therapist@example.com', password: 'SecurePass1!' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // No auth cookies set
    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).not.toContain('access_token');

    const body = (await response.json()) as {
      success: boolean;
      data: { requiresTwoFactor: boolean; userId: string };
    };
    expect(body.data.requiresTwoFactor).toBe(true);
    expect(body.data.userId).toBe('user-uuid-123');
  });

  it('returns 401 on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(401);

    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 500 on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
  });
});
