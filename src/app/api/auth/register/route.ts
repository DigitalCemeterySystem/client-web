import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/core/auth/session';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const forwardedFor = request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';
  const backendResponse = await fetchBackend('/api/auth/register', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': forwardedFor,
    },
  });

  const payload = await backendResponse.text();
  return new NextResponse(payload, {
    status: backendResponse.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
