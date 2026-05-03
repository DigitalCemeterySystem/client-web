import { NextResponse } from 'next/server';
import { clearSessionCookies, fetchBackend, readRefreshToken } from '@/core/auth/session';
import { demoLogout } from '@/core/demo/auth';
import { isDemoMode } from '@/core/demo/mode';

export async function POST() {
  if (isDemoMode()) {
    return demoLogout();
  }

  const refreshToken = await readRefreshToken();

  if (refreshToken) {
    await fetchBackend('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = NextResponse.json({ message: 'Выход выполнен.' });
  clearSessionCookies(response);
  return response;
}
