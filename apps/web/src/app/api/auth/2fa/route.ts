import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;
const IS_PROD = process.env['NODE_ENV'] === 'production';

interface TwoFaResponseData {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}

/**
 * BFF proxy — POST /api/auth/2fa
 * Forwards { userId, token } to NestJS POST /auth/2fa/verify.
 * On success, sets httpOnly access_token + refresh_token cookies.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    const nestResponse = await fetch(`${API_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const nestBody = (await nestResponse.json()) as {
      success: boolean;
      data?: TwoFaResponseData;
      error?: unknown;
    };

    if (!nestResponse.ok) {
      return NextResponse.json(nestBody, { status: nestResponse.status });
    }

    const data = nestBody.data;

    if (data?.accessToken && data?.refreshToken) {
      const response = NextResponse.json({ success: true, data: { user: data.user } });
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reach API' } },
      { status: 500 },
    );
  }
}
