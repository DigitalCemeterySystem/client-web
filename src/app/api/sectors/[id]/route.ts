import { NextRequest, NextResponse } from 'next/server';
import { getDemoCemeteries } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, `/api/sectors/${id}`);
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo sectors are read-only.' }, { status: 405 });
  }

  const sector = getDemoCemeteries()
    .flatMap((cemetery) => cemetery.sectors ?? [])
    .find((item) => item.id === Number(id));

  if (!sector) {
    return NextResponse.json({ message: 'Sector not found.' }, { status: 404 });
  }

  return NextResponse.json(sector);
}

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
