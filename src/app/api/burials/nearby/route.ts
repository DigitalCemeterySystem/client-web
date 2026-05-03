import { NextRequest, NextResponse } from 'next/server';
import { findNearbyDemoBurials } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, '/api/burials/nearby');
  }

  const latitude = Number(request.nextUrl.searchParams.get('lat'));
  const longitude = Number(request.nextUrl.searchParams.get('lon'));
  const radius = Number(request.nextUrl.searchParams.get('radius') ?? 100);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ message: 'lat and lon are required.' }, { status: 400 });
  }

  return NextResponse.json(findNearbyDemoBurials(latitude, longitude, Number.isFinite(radius) ? radius : 100));
}
