import { NextRequest, NextResponse } from 'next/server';
import { getDemoCemeteries } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest) {
  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, '/api/cemeteries');
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo cemeteries are read-only.' }, { status: 405 });
  }
  return NextResponse.json(getDemoCemeteries());
}

export const GET = handler;
export const POST = handler;
