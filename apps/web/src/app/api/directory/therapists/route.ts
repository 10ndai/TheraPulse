import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = `${process.env['API_URL'] ?? 'http://localhost:3001'}/api`;

/**
 * BFF proxy — GET /api/directory/therapists
 * Public endpoint — no auth cookie needed.
 * Forwards all query params (name, city, specialization, page, limit) to NestJS.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Forward all search params as-is
    const params = req.nextUrl.searchParams.toString();
    const url = `${API_URL}/directory/therapists${params ? `?${params}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
