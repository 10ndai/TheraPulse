import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;

/** BFF proxy — GET /api/worksheet-templates/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('access_token');

  if (!tokenCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;
    const response = await fetch(`${API_URL}/worksheet-templates/${id}`, {
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

/** BFF proxy — PATCH /api/worksheet-templates/:id: update draft template. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('access_token');

  if (!tokenCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;
    const body: unknown = await req.json();
    const response = await fetch(`${API_URL}/worksheet-templates/${id}`, {
      method: 'PATCH',
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
