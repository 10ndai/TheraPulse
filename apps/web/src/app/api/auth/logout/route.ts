import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;

/**
 * BFF proxy — POST /api/auth/logout
 * Calls NestJS POST /auth/logout (if access token exists), then clears cookies.
 * Always clears cookies regardless of NestJS response.
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('access_token');

  try {
    if (tokenCookie) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenCookie.value}` },
        cache: 'no-store',
      });
    }

    const response = NextResponse.json({ success: true, data: null });
    response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
    response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth/refresh' });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Logout failed' } },
      { status: 500 },
    );
  }
}
