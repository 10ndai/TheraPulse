import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;

/** BFF proxy — POST /api/worksheet-templates: create a new draft template. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('access_token');

  if (!tokenCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await req.json();
    const response = await fetch(`${API_URL}/worksheet-templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenCookie.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reach API' } },
      { status: 500 },
    );
  }
}

/** BFF proxy — GET /api/worksheet-templates: list templates with optional filters. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('access_token');

  if (!tokenCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  try {
    const params = req.nextUrl.searchParams.toString();
    const url = `${API_URL}/worksheet-templates${params ? `?${params}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenCookie.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reach API' } },
      { status: 500 },
    );
  }
}
