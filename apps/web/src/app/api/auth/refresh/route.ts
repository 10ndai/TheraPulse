import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;
const IS_PROD = process.env['NODE_ENV'] === 'production';

interface RefreshResponseData {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * BFF proxy — POST /api/auth/refresh
 * Reads the refresh_token httpOnly cookie, sends it to NestJS POST /auth/refresh.
 * On success, sets new access_token and refresh_token cookies (rotation).
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get('refresh_token');

  if (!refreshCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token' } },
      { status: 401 },
    );
  }

  try {
    const nestResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshCookie.value }),
      cache: 'no-store',
    });

    const nestBody = (await nestResponse.json()) as {
      success: boolean;
      data?: RefreshResponseData;
      error?: unknown;
    };

    if (!nestResponse.ok) {
      return NextResponse.json(nestBody, { status: nestResponse.status });
    }

    const data = nestBody.data;

    if (data?.accessToken && data?.refreshToken) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('access_token', data.accessToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 60,
      });
      response.cookies.set('refresh_token', data.refreshToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60,
      });
      return response;
    }

    return NextResponse.json(nestBody, { status: nestResponse.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Token refresh failed' } },
      { status: 500 },
    );
  }
}
