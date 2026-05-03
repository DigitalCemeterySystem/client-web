import { NextRequest, NextResponse } from 'next/server';
import type { UserProfileResponse, UserRole } from '@/types';
import {
  applySessionCookies,
  clearSessionCookies,
  fetchBackend,
  readSessionTokens,
  refreshSession,
} from '@/core/auth/session';
import { requireDemoUser } from '@/core/demo/auth';
import { isDemoMode } from '@/core/demo/mode';
import { handleDemoServiceRequest } from '@/core/demo/rag';

type AuthorizedContext = {
  accessToken: string;
  refreshedSession: Awaited<ReturnType<typeof refreshSession>>;
  user: UserProfileResponse;
};

async function loadUserWithToken(accessToken: string | null) {
  try {
    return await fetchBackend('/api/auth/me', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } catch {
    return null;
  }
}

async function authorize(allowedRoles: UserRole[]): Promise<AuthorizedContext | NextResponse> {
  const tokens = await readSessionTokens();
  let accessToken = tokens.accessToken;
  const refreshToken = tokens.refreshToken;
  let refreshedSession: Awaited<ReturnType<typeof refreshSession>> = null;

  let profileResponse = await loadUserWithToken(accessToken);
  if (!profileResponse) {
    return NextResponse.json({ message: 'API Gateway временно недоступен.' }, { status: 503 });
  }
  if (profileResponse.status === 401) {
    refreshedSession = await refreshSession(refreshToken);
    if (!refreshedSession) {
      const response = NextResponse.json({ message: 'Необходима авторизация.' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }
    accessToken = refreshedSession.accessToken;
    profileResponse = await loadUserWithToken(accessToken);
    if (!profileResponse) {
      return NextResponse.json({ message: 'API Gateway временно недоступен.' }, { status: 503 });
    }
  }

  if (!profileResponse.ok) {
    return NextResponse.json({ message: 'Не удалось проверить права доступа.' }, { status: profileResponse.status });
  }

  const user = (await profileResponse.json()) as UserProfileResponse;
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ message: 'Недостаточно прав для выполнения операции.' }, { status: 403 });
  }

  return { accessToken: accessToken!, refreshedSession, user };
}

export async function proxyAuthorizedRequest(request: NextRequest, backendPath: string, allowedRoles: UserRole[]) {
  if (isDemoMode()) {
    const auth = requireDemoUser(request, allowedRoles);
    if (auth.response) {
      return auth.response;
    }
    return handleDemoServiceRequest(request, backendPath);
  }

  const auth = await authorize(allowedRoles);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
  };
  const contentType = request.headers.get('Content-Type');
  if (contentType && body) {
    headers['Content-Type'] = contentType;
  }

  const search = request.nextUrl.search || '';
  let backendResponse: Response;
  try {
    backendResponse = await fetchBackend(`${backendPath}${search}`, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return NextResponse.json({ message: 'Целевой сервис временно недоступен.' }, { status: 503 });
  }

  const payload = await backendResponse.arrayBuffer();
  const response = new NextResponse(payload, {
    status: backendResponse.status,
    headers: {
      'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
      ...(backendResponse.headers.get('Content-Disposition')
        ? { 'Content-Disposition': backendResponse.headers.get('Content-Disposition')! }
        : {}),
    },
  });

  if (auth.refreshedSession) {
    applySessionCookies(response, auth.refreshedSession);
  }
  if (backendResponse.status === 401) {
    clearSessionCookies(response);
  }

  return response;
}
