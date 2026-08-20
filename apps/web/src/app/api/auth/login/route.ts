import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;
const IS_PROD = process.env['NODE_ENV'] === 'production';

interface LoginResponseData {
  requiresTwoFactor?: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}

/**
 * BFF proxy — POST /api/auth/login
 *
 * Two outcomes:
 *  1. 2FA required → returns { requiresTwoFactor: true, userId } — no cookies set yet
 *  2. No 2FA → sets httpOnly access_token + refresh_token cookies, returns user
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    const nestResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const nestBody = (await nestResponse.json()) as {
      success: boolean;
      data?: LoginResponseData;
      error?: unknown;
    };

    if (!nestResponse.ok) {
      return NextResponse.json(nestBody, { status: nestResponse.status });
    }

    const data = nestBody.data;

    // 2FA required — return userId without setting cookies
    if (data?.requiresTwoFactor) {
      return NextResponse.json({
        success: true,
        data: { requiresTwoFactor: true, userId: data.userId },
      });
    }

    // Full login — set httpOnly cookies
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
