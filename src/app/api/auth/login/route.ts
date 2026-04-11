import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, fetchBackend, toWebSessionResponse } from '@/core/auth/session';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const backendResponse = await fetchBackend('/api/auth/login', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });

  const payload = await backendResponse.json();
  const response = NextResponse.json(
    backendResponse.ok ? toWebSessionResponse(payload) : payload,
    { status: backendResponse.status }
  );

  if (backendResponse.ok) {
    applySessionCookies(response, payload);
  }

  return response;
}
