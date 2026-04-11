import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserProfileResponse, WebSessionResponse } from '@/types';

const ACCESS_COOKIE = 'dcs_access_token';
const REFRESH_COOKIE = 'dcs_refresh_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfileResponse;
}

export async function fetchBackend(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export function applySessionCookies(response: NextResponse, session: BackendAuthResponse) {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
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

export async function refreshSessionIfNeeded() {
  const refreshToken = await readRefreshToken();
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
