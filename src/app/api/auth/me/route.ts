import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  clearSessionCookies,
  fetchBackend,
  readAccessToken,
  refreshSessionIfNeeded,
} from '@/core/auth/session';

async function authorizedRequest(method: 'GET' | 'PATCH', body?: string) {
  let accessToken = await readAccessToken();

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
    refreshedSession = await refreshSessionIfNeeded();
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

export async function GET() {
  return authorizedRequest('GET');
}

export async function PATCH(request: NextRequest) {
  const body = await request.text();
  return authorizedRequest('PATCH', body);
}
