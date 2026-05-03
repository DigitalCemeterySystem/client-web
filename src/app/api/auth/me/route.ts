import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  clearSessionCookies,
  fetchBackend,
  readSessionTokens,
  refreshSession,
} from '@/core/auth/session';
import { demoUpdateProfile, getDemoUser } from '@/core/demo/auth';
import { isDemoMode } from '@/core/demo/mode';

async function authorizedRequest(method: 'GET' | 'PATCH', accessToken: string | null, refreshToken: string | null, body?: string) {

  const requestBackend = (token: string | null) =>
    fetchBackend('/api/auth/me', {
      method,
      body,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
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

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    const user = request ? getDemoUser(request) : null;
    return user
      ? NextResponse.json(user)
      : NextResponse.json({ message: 'Demo authorization required.' }, { status: 401 });
  }

  const { accessToken, refreshToken } = await readSessionTokens();
  return authorizedRequest('GET', accessToken, refreshToken);
}

export async function PATCH(request: NextRequest) {
  if (isDemoMode()) {
    return demoUpdateProfile(request);
  }

  const { accessToken, refreshToken } = await readSessionTokens();
  const body = await request.text();
  return authorizedRequest('PATCH', accessToken, refreshToken, body);
}
