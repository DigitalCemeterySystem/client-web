import { NextRequest, NextResponse } from 'next/server';
import type { UserProfileResponse, UserRole } from '@/types';

const DEMO_SESSION_COOKIE = 'dcs_demo_session';
const DEMO_PROFILE_COOKIE = 'dcs_demo_profile';
const DEMO_PASSWORD = 'demo12345';

const createdAt = '2026-05-03T00:00:00.000Z';

export const demoUsers: UserProfileResponse[] = [
  {
    id: 101,
    email: 'user@demo.local',
    username: 'demo-user',
    avatarUrl: null,
    bio: 'Demo user for creating burial change requests.',
    role: 'USER',
    status: 'ACTIVE',
    emailVerifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 102,
    email: 'moderator@demo.local',
    username: 'demo-moderator',
    avatarUrl: null,
    bio: 'Demo moderator for reviewing user requests.',
    role: 'MODERATOR',
    status: 'ACTIVE',
    emailVerifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 103,
    email: 'admin@demo.local',
    username: 'demo-admin',
    avatarUrl: null,
    bio: 'Demo administrator with access to request moderation and RAG panels.',
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  },
];

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.SESSION_COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

function decodeCookie<T>(value: string | undefined | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function encodeCookie(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function findDemoUser(login: string) {
  const normalized = login.trim().toLocaleLowerCase('ru');
  return (
    demoUsers.find(
      (user) =>
        user.email.toLocaleLowerCase('ru') === normalized ||
        user.username.toLocaleLowerCase('ru') === normalized
    ) ?? null
  );
}

export function getDemoUser(request: NextRequest) {
  const session = decodeCookie<{ userId: number }>(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (!session) return null;

  const baseUser = demoUsers.find((user) => user.id === session.userId) ?? null;
  if (!baseUser) return null;

  const profileOverrides = decodeCookie<Record<string, Partial<UserProfileResponse>>>(
    request.cookies.get(DEMO_PROFILE_COOKIE)?.value
  );
  const overrides = profileOverrides?.[String(baseUser.id)] ?? {};
  return {
    ...baseUser,
    ...overrides,
    id: baseUser.id,
    email: baseUser.email,
    role: baseUser.role,
    status: baseUser.status,
    updatedAt: overrides.updatedAt ?? baseUser.updatedAt,
  };
}

export function requireDemoUser(request: NextRequest, allowedRoles?: UserRole[]) {
  const user = getDemoUser(request);
  if (!user) {
    return {
      response: NextResponse.json({ message: 'Demo authorization required.' }, { status: 401 }),
      user: null,
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      response: NextResponse.json({ message: 'Insufficient demo permissions.' }, { status: 403 }),
      user: null,
    };
  }

  return { response: null, user };
}

export async function demoLogin(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as {
    emailOrUsername?: string;
    password?: string;
  };
  const user = findDemoUser(payload.emailOrUsername ?? '');

  if (!user || payload.password !== DEMO_PASSWORD) {
    return NextResponse.json({ message: 'Use one of the demo accounts and password demo12345.' }, { status: 401 });
  }

  const response = NextResponse.json({
    tokenType: 'Bearer',
    expiresIn: 60 * 60 * 24,
    user,
  });
  response.cookies.set(DEMO_SESSION_COOKIE, encodeCookie({ userId: user.id }), cookieOptions());
  return response;
}

export function demoLogout() {
  const response = NextResponse.json({ message: 'Demo logout completed.' });
  response.cookies.set(DEMO_SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return response;
}

export async function demoUpdateProfile(request: NextRequest) {
  const auth = requireDemoUser(request);
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    avatarUrl?: string | null;
    bio?: string | null;
  };

  const nextUser: UserProfileResponse = {
    ...auth.user!,
    username: payload.username?.trim() || auth.user!.username,
    avatarUrl: payload.avatarUrl ?? auth.user!.avatarUrl,
    bio: payload.bio ?? auth.user!.bio,
    updatedAt: new Date().toISOString(),
  };

  const currentOverrides =
    decodeCookie<Record<string, Partial<UserProfileResponse>>>(request.cookies.get(DEMO_PROFILE_COOKIE)?.value) ?? {};
  currentOverrides[String(nextUser.id)] = {
    username: nextUser.username,
    avatarUrl: nextUser.avatarUrl,
    bio: nextUser.bio,
    updatedAt: nextUser.updatedAt,
  };

  const response = NextResponse.json(nextUser);
  response.cookies.set(DEMO_PROFILE_COOKIE, encodeCookie(currentOverrides), cookieOptions());
  return response;
}

export function demoRegister() {
  return NextResponse.json({
    message: 'Demo registration is simulated. Use user@demo.local, moderator@demo.local or admin@demo.local.',
  });
}

export function demoPasswordChange() {
  return NextResponse.json({ message: 'Demo password change completed.' });
}

export function demoVerifyEmail() {
  return NextResponse.json({ message: 'Demo email verification completed.' });
}

export function demoResendVerification() {
  return NextResponse.json({ message: 'Demo verification email sent.' });
}

