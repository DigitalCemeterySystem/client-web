import { NextRequest, NextResponse } from 'next/server';
import { getDemoCemeteries } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest) {
  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, '/api/sectors');
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo sectors are read-only.' }, { status: 405 });
  }

  const cemeteryIdRaw = request.nextUrl.searchParams.get('cemeteryId');
  const cemeteryId = cemeteryIdRaw == null ? null : Number(cemeteryIdRaw);
  const sectors = getDemoCemeteries().flatMap((cemetery) => cemetery.sectors ?? []);
  return NextResponse.json(
    cemeteryId == null || !Number.isFinite(cemeteryId)
      ? sectors
      : sectors.filter((sector) => sector.cemeteryId === cemeteryId)
  );
}

export const GET = handler;
export const POST = handler;
