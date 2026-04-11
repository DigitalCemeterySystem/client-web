import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/core/auth/session';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Токен подтверждения не указан.' }, { status: 400 });
  }

  const backendResponse = await fetchBackend(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  const payload = await backendResponse.text();

  return new NextResponse(payload, {
    status: backendResponse.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
