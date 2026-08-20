import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;

/**
 * BFF proxy — PATCH /api/admin/therapists/:id/reject
 * Admin-only: rejects a pending therapist application.
 */
export async function PATCH(
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
    const response = await fetch(`${API_URL}/admin/therapists/${id}/reject`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenCookie.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const body: unknown = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reach API' } },
      { status: 500 },
    );
  }
}
