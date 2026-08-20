import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = `${process.env.API_URL ?? 'http://localhost:3001'}/api`;

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token)
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );

  try {
    const res = await fetch(`${API_URL}/worksheet-submissions/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
