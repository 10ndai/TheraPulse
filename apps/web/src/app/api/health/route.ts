import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const apiUrl = process.env['API_URL'];

  if (!apiUrl) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'API URL not configured' },
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach API' },
      },
      { status: 502 },
    );
  }
}
