import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = `${process.env.API_URL ?? 'http://localhost:3001'}/api`;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();

  const res = await fetch(`${API_URL}/audit-logs${qs ? `?${qs}` : ''}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
