import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  clearSessionCookies,
  refreshSession,
} from '@/core/auth/session';

type SupportedMethod = 'GET' | 'POST' | 'PUT';

const CHANGE_REQUESTS_API_URL =
  process.env.CHANGE_REQUESTS_API_URL ||
  (process.env.NEXT_PUBLIC_API_URL?.includes('api-gateway')
    ? 'http://cemetery-management-service:8081'
    : 'http://localhost:8081');

async function fetchChangeRequestBackend(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${CHANGE_REQUESTS_API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function proxyChangeRequest(
  request: NextRequest,
  backendPath: string,
  method: SupportedMethod
) {
  const initialAccessToken = request.cookies.get('dcs_access_token')?.value ?? null;
  const refreshToken = request.cookies.get('dcs_refresh_token')?.value ?? null;
  const body = method === 'GET' ? undefined : await request.text();
  let accessToken = initialAccessToken;

  const requestBackend = (token: string | null) =>
    fetchChangeRequestBackend(backendPath, {
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
    headers: {
      'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
    },
  });

  if (refreshedSession) {
    applySessionCookies(response, refreshedSession);
  }

  if (backendResponse.status === 401) {
    clearSessionCookies(response);
  }

  return response;
}
