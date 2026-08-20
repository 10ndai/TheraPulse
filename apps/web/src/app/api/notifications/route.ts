import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = `${process.env.API_URL ?? 'http://localhost:3001'}/api`;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const search = req.nextUrl.search;

  const res = await fetch(`${API_URL}/notifications${search}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
