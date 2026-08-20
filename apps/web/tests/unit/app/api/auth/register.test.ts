import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../../../src/app/api/auth/register/route';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards valid registration to NestJS and returns 201', async () => {
    const registeredUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'new@example.com',
      role: 'THERAPIST',
      status: 'PENDING',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { user: registeredUser } }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'SecurePass1!',
        role: 'THERAPIST',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      success: boolean;
      data: { user: typeof registeredUser };
    };
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('new@example.com');

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0] as string).toContain('/auth/register');
  });

  it('returns 400 when NestJS returns a validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email is invalid' },
        }),
      }),
    );

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad', password: 'pass', role: 'CLIENT' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 500 when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')));

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'SecurePass1!', role: 'CLIENT' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    expect(response.status).toBe(500);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
