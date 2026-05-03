import { NextRequest, NextResponse } from 'next/server';
import { getDemoBurials } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest) {
  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, '/api/burials');
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo burials are managed through change requests.' }, { status: 405 });
  }

  const cemeteryIdRaw = request.nextUrl.searchParams.get('cemeteryId');
  const cemeteryId = cemeteryIdRaw == null ? null : Number(cemeteryIdRaw);
  return NextResponse.json(getDemoBurials(Number.isFinite(cemeteryId) ? cemeteryId : null));
}

export const GET = handler;
export const POST = handler;
