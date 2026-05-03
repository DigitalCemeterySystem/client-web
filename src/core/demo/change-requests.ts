import { NextRequest, NextResponse } from 'next/server';
import type {
  BurialChangeDraftRequest,
  BurialChangeFieldKey,
  ChangeRequestFieldResponse,
  ChangeRequestResponse,
  ChangeRequestStatus,
  UserProfileResponse,
  UserRole,
} from '@/types';
import { getDemoBurial, resolveDemoPlacement } from '@/core/demo/data';
import { requireDemoUser } from '@/core/demo/auth';

const REQUESTS_COOKIE = 'dcs_demo_requests';
const createdAt = '2026-05-03T00:00:00.000Z';

const fieldLabels: Record<BurialChangeFieldKey, string> = {
  PHOTO_URL: 'Photo URL',
  FULL_NAME: 'Full name',
  BIRTH_DATE: 'Birth date',
  DEATH_DATE: 'Death date',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  BIOGRAPHY: 'Biography',
  CEMETERY_NAME: 'Cemetery',
  SECTOR_NAME: 'Sector',
};

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

function roleOf(user: UserProfileResponse): UserRole {
  return user.role;
}

function field(fieldKey: BurialChangeFieldKey, beforeValue: unknown, afterValue: unknown): ChangeRequestFieldResponse {
  return {
    fieldKey,
    fieldLabel: fieldLabels[fieldKey],
    beforeValue: beforeValue == null || beforeValue === '' ? null : String(beforeValue),
    afterValue: afterValue == null || afterValue === '' ? null : String(afterValue),
  };
}

function makeBaseRequests(): ChangeRequestResponse[] {
  const firstBurial = getDemoBurial(1);
  const secondBurial = getDemoBurial(2);
  const thirdBurial = getDemoBurial(3);

  return [
    {
      id: 1,
      targetType: 'BURIAL',
      operationType: 'EDIT',
      status: 'PENDING',
      authorUserId: 101,
      authorUsername: 'demo-user',
      authorRole: 'USER',
      burialId: firstBurial?.id ?? null,
      burialLabel: firstBurial?.fullName ?? 'Demo burial',
      previewLatitude: firstBurial?.latitude ?? null,
      previewLongitude: firstBurial?.longitude ?? null,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedByUsername: null,
      reviewedByRole: null,
      createdAt,
      updatedAt: createdAt,
      reviewedAt: null,
      fields: [field('BIOGRAPHY', firstBurial?.biography, `${firstBurial?.biography ?? ''}\n\nDemo update from a user request.`)],
    },
    {
      id: 2,
      targetType: 'BURIAL',
      operationType: 'ADD',
      status: 'APPROVED',
      authorUserId: 101,
      authorUsername: 'demo-user',
      authorRole: 'USER',
      burialId: null,
      burialLabel: 'Demo approved addition',
      previewLatitude: secondBurial?.latitude ?? null,
      previewLongitude: secondBurial?.longitude ?? null,
      rejectionReason: null,
      reviewedByUserId: 102,
      reviewedByUsername: 'demo-moderator',
      reviewedByRole: 'MODERATOR',
      createdAt,
      updatedAt: createdAt,
      reviewedAt: createdAt,
      fields: [
        field('FULL_NAME', null, 'Demo approved addition'),
        field('LATITUDE', null, secondBurial?.latitude),
        field('LONGITUDE', null, secondBurial?.longitude),
        field('BIOGRAPHY', null, 'Approved demo request for presentation.'),
      ],
    },
    {
      id: 3,
      targetType: 'BURIAL',
      operationType: 'EDIT',
      status: 'REJECTED',
      authorUserId: 101,
      authorUsername: 'demo-user',
      authorRole: 'USER',
      burialId: thirdBurial?.id ?? null,
      burialLabel: thirdBurial?.fullName ?? 'Demo rejected request',
      previewLatitude: thirdBurial?.latitude ?? null,
      previewLongitude: thirdBurial?.longitude ?? null,
      rejectionReason: 'Not enough source evidence in the demo scenario.',
      reviewedByUserId: 102,
      reviewedByUsername: 'demo-moderator',
      reviewedByRole: 'MODERATOR',
      createdAt,
      updatedAt: createdAt,
      reviewedAt: createdAt,
      fields: [field('PHOTO_URL', thirdBurial?.photoUrl, 'https://example.com/demo-photo.jpg')],
    },
  ];
}

function readRequests(request: NextRequest) {
  return decodeCookie<ChangeRequestResponse[]>(request.cookies.get(REQUESTS_COOKIE)?.value) ?? makeBaseRequests();
}

function withRequestsCookie(response: NextResponse, requests: ChangeRequestResponse[]) {
  response.cookies.set(REQUESTS_COOKIE, encodeCookie(requests), cookieOptions());
  return response;
}

function buildFieldsFromDraft(
  draft: BurialChangeDraftRequest,
  sourceBurial?: ReturnType<typeof getDemoBurial>
) {
  const fields: ChangeRequestFieldResponse[] = [];
  if (draft.fullName !== undefined) fields.push(field('FULL_NAME', sourceBurial?.fullName, draft.fullName));
  if (draft.birthDate !== undefined || draft.clearBirthDate) fields.push(field('BIRTH_DATE', sourceBurial?.birthDate, draft.clearBirthDate ? null : draft.birthDate));
  if (draft.deathDate !== undefined || draft.clearDeathDate) fields.push(field('DEATH_DATE', sourceBurial?.deathDate, draft.clearDeathDate ? null : draft.deathDate));
  if (draft.latitude !== undefined) fields.push(field('LATITUDE', sourceBurial?.latitude, draft.latitude));
  if (draft.longitude !== undefined) fields.push(field('LONGITUDE', sourceBurial?.longitude, draft.longitude));
  if (draft.photoUrl !== undefined || draft.clearPhotoUrl) fields.push(field('PHOTO_URL', sourceBurial?.photoUrl, draft.clearPhotoUrl ? null : draft.photoUrl));
  if (draft.biography !== undefined || draft.clearBiography) fields.push(field('BIOGRAPHY', sourceBurial?.biography, draft.clearBiography ? null : draft.biography));

  const placement = resolveDemoPlacement(
    draft.latitude ?? sourceBurial?.latitude,
    draft.longitude ?? sourceBurial?.longitude
  );
  if (placement.cemetery) fields.push(field('CEMETERY_NAME', sourceBurial?.cemeteryName, placement.cemetery.name));
  if (placement.sector) fields.push(field('SECTOR_NAME', sourceBurial?.sectorName, placement.sector.name));

  return fields;
}

function makeRequestFromDraft(
  id: number,
  operationType: 'ADD' | 'EDIT',
  draft: BurialChangeDraftRequest,
  author: UserProfileResponse,
  sourceBurial?: ReturnType<typeof getDemoBurial>
): ChangeRequestResponse {
  const fields = buildFieldsFromDraft(draft, sourceBurial);
  const fullName = fields.find((item) => item.fieldKey === 'FULL_NAME')?.afterValue ?? sourceBurial?.fullName ?? 'New demo burial';
  const latitude = Number(fields.find((item) => item.fieldKey === 'LATITUDE')?.afterValue ?? sourceBurial?.latitude);
  const longitude = Number(fields.find((item) => item.fieldKey === 'LONGITUDE')?.afterValue ?? sourceBurial?.longitude);
  const timestamp = new Date().toISOString();

  return {
    id,
    targetType: 'BURIAL',
    operationType,
    status: 'PENDING',
    authorUserId: author.id,
    authorUsername: author.username,
    authorRole: roleOf(author),
    burialId: operationType === 'EDIT' ? sourceBurial?.id ?? null : null,
    burialLabel: fullName,
    previewLatitude: Number.isFinite(latitude) ? latitude : null,
    previewLongitude: Number.isFinite(longitude) ? longitude : null,
    rejectionReason: null,
    reviewedByUserId: null,
    reviewedByUsername: null,
    reviewedByRole: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    reviewedAt: null,
    fields: fields.length ? fields : [field('FULL_NAME', sourceBurial?.fullName, fullName)],
  };
}

function markReviewed(
  item: ChangeRequestResponse,
  reviewer: UserProfileResponse,
  status: ChangeRequestStatus,
  rejectionReason: string | null
): ChangeRequestResponse {
  const timestamp = new Date().toISOString();
  return {
    ...item,
    status,
    rejectionReason,
    reviewedByUserId: reviewer.id,
    reviewedByUsername: reviewer.username,
    reviewedByRole: reviewer.role,
    reviewedAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function handleDemoChangeRequest(
  request: NextRequest,
  backendPath: string,
  method: 'GET' | 'POST' | 'PUT'
) {
  const auth = requireDemoUser(request);
  if (auth.response) return auth.response;

  const user = auth.user!;
  const requests = readRequests(request);
  const path = backendPath.replace(/^\/api\/change-requests/, '') || '/';

  if (method === 'GET' && path === '/my') {
    return NextResponse.json(requests.filter((item) => item.authorUserId === user.id));
  }

  if (method === 'GET' && path === '/') {
    if (user.role !== 'MODERATOR' && user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Moderator role is required.' }, { status: 403 });
    }
    return NextResponse.json(requests);
  }

  if (method === 'POST' && path === '/burials/add') {
    const draft = (await request.json().catch(() => ({}))) as BurialChangeDraftRequest;
    const next = makeRequestFromDraft(Math.max(0, ...requests.map((item) => item.id)) + 1, 'ADD', draft, user);
    const response = NextResponse.json(next, { status: 201 });
    return withRequestsCookie(response, [next, ...requests]);
  }

  const editMatch = path.match(/^\/burials\/(\d+)\/edit$/);
  if (method === 'POST' && editMatch) {
    const burial = getDemoBurial(Number(editMatch[1]));
    if (!burial) return NextResponse.json({ message: 'Burial not found.' }, { status: 404 });
    const draft = (await request.json().catch(() => ({}))) as BurialChangeDraftRequest;
    const next = makeRequestFromDraft(Math.max(0, ...requests.map((item) => item.id)) + 1, 'EDIT', draft, user, burial);
    const response = NextResponse.json(next, { status: 201 });
    return withRequestsCookie(response, [next, ...requests]);
  }

  const draftMatch = path.match(/^\/(\d+)\/draft$/);
  if (method === 'PUT' && draftMatch) {
    const requestId = Number(draftMatch[1]);
    const index = requests.findIndex((item) => item.id === requestId);
    if (index < 0) return NextResponse.json({ message: 'Request not found.' }, { status: 404 });
    const current = requests[index];
    if (current.authorUserId !== user.id || current.status !== 'PENDING') {
      return NextResponse.json({ message: 'Draft cannot be edited.' }, { status: 403 });
    }

    const draft = (await request.json().catch(() => ({}))) as BurialChangeDraftRequest;
    const burial = current.burialId ? getDemoBurial(current.burialId) : null;
    const updated = {
      ...makeRequestFromDraft(current.id, current.operationType, draft, user, burial),
      createdAt: current.createdAt,
    };
    const nextRequests = requests.slice();
    nextRequests[index] = updated;
    const response = NextResponse.json(updated);
    return withRequestsCookie(response, nextRequests);
  }

  const approveMatch = path.match(/^\/(\d+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    if (user.role !== 'MODERATOR' && user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Moderator role is required.' }, { status: 403 });
    }
    const requestId = Number(approveMatch[1]);
    const index = requests.findIndex((item) => item.id === requestId);
    if (index < 0) return NextResponse.json({ message: 'Request not found.' }, { status: 404 });
    const updated = markReviewed(requests[index], user, 'APPROVED', null);
    const nextRequests = requests.slice();
    nextRequests[index] = updated;
    const response = NextResponse.json(updated);
    return withRequestsCookie(response, nextRequests);
  }

  const rejectMatch = path.match(/^\/(\d+)\/reject$/);
  if (method === 'POST' && rejectMatch) {
    if (user.role !== 'MODERATOR' && user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Moderator role is required.' }, { status: 403 });
    }
    const requestId = Number(rejectMatch[1]);
    const index = requests.findIndex((item) => item.id === requestId);
    if (index < 0) return NextResponse.json({ message: 'Request not found.' }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const updated = markReviewed(requests[index], user, 'REJECTED', body.reason?.trim() || 'Rejected in demo mode.');
    const nextRequests = requests.slice();
    nextRequests[index] = updated;
    const response = NextResponse.json(updated);
    return withRequestsCookie(response, nextRequests);
  }

  return NextResponse.json({ message: `Demo change request route is not implemented: ${method} ${path}` }, { status: 404 });
}

