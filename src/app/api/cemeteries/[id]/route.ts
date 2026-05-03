import { NextRequest, NextResponse } from 'next/server';
import { getDemoCemetery } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, `/api/cemeteries/${id}`);
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo cemeteries are read-only.' }, { status: 405 });
  }

  const cemetery = getDemoCemetery(Number(id));
  if (!cemetery) {
    return NextResponse.json({ message: 'Cemetery not found.' }, { status: 404 });
  }

  return NextResponse.json(cemetery);
}

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
