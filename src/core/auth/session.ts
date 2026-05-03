import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserProfileResponse, WebSessionResponse } from '@/types';

const ACCESS_COOKIE = 'dcs_access_token';
const REFRESH_COOKIE = 'dcs_refresh_token';
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE;

function shouldUseSecureCookies() {
  if (SESSION_COOKIE_SECURE === 'true') {
    return true;
  }

  if (SESSION_COOKIE_SECURE === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfileResponse;
}

type FetchBackendError = Error & {
  code?: string;
  rawPacket?: Buffer;
};

function isUnauthorizedClosedConnection(error: unknown) {
  if (!(error instanceof Error)) return false;

  const candidate = error as FetchBackendError;
  if (candidate.code !== 'HPE_CLOSED_CONNECTION') {
    return false;
  }

  if (!candidate.rawPacket) {
    return false;
  }

  const rawText = candidate.rawPacket.toString('utf-8');
  return rawText.startsWith('HTTP/1.1 401 Unauthorized');
}

export async function fetchBackend(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    // Spring Gateway иногда закрывает ответ 401 так, что undici
    // возвращает ошибку парсера вместо обычного ответа.
    if (isUnauthorizedClosedConnection(error)) {
      return new Response(null, { status: 401 });
    }

    throw error;
  }
}

export function applySessionCookies(response: NextResponse, session: BackendAuthResponse) {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge: session.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  const secure = shouldUseSecureCookies();
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
}

export function toWebSessionResponse(session: BackendAuthResponse): WebSessionResponse {
  return {
    tokenType: session.tokenType,
    expiresIn: session.expiresIn,
    user: session.user,
  };
}

export async function readAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

export async function readSessionTokens() {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_COOKIE)?.value ?? null,
  };
}

export async function refreshSession(refreshToken: string | null) {
  if (!refreshToken) {
    return null;
  }

  const refreshResponse = await fetchBackend('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    return null;
  }

  return (await refreshResponse.json()) as BackendAuthResponse;
}

export async function refreshSessionIfNeeded() {
  return refreshSession(await readRefreshToken());
}
