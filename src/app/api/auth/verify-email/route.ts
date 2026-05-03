import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/core/auth/session';
import { demoVerifyEmail } from '@/core/demo/auth';
import { isDemoMode } from '@/core/demo/mode';

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    return demoVerifyEmail();
  }

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
