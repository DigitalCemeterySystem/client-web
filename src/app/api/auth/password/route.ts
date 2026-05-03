import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  clearSessionCookies,
  fetchBackend,
  readSessionTokens,
  refreshSession,
} from '@/core/auth/session';
import { demoPasswordChange } from '@/core/demo/auth';
import { isDemoMode } from '@/core/demo/mode';

export async function PATCH(request: NextRequest) {
  if (isDemoMode()) {
    return demoPasswordChange();
  }

  const { accessToken: initialAccessToken, refreshToken } = await readSessionTokens();
  const body = await request.text();
  let accessToken = initialAccessToken;

  const requestBackend = (token: string | null) =>
    fetchBackend('/api/auth/me/password', {
      method: 'PATCH',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let backendResponse = await requestBackend(accessToken);
  let refreshedSession = null;

  if (backendResponse.status === 401) {
    refreshedSession = await refreshSession(refreshToken);
    if (!refreshedSession) {
      const unauthorizedResponse = NextResponse.json({ message: 'Необходима авторизация.' }, { status: 401 });
      clearSessionCookies(unauthorizedResponse);
      return unauthorizedResponse;
    }
    accessToken = refreshedSession.accessToken;
    backendResponse = await requestBackend(accessToken);
  }

  const payload = await backendResponse.text();
  const response = new NextResponse(payload, {
    status: backendResponse.status,
    headers: { 'Content-Type': 'application/json' },
  });

  if (refreshedSession) {
    applySessionCookies(response, refreshedSession);
  }

  if (backendResponse.status === 401) {
    clearSessionCookies(response);
  }

  return response;
}
