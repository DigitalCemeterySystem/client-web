import { NextRequest, NextResponse } from 'next/server';
import { searchDemoBurials } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, '/api/burials/search');
  }

  return NextResponse.json(searchDemoBurials(request.nextUrl.searchParams.get('name') ?? ''));
}
