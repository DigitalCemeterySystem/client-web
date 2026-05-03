import { NextRequest, NextResponse } from 'next/server';
import { getDemoBurial } from '@/core/demo/data';
import { isDemoMode } from '@/core/demo/mode';
import { proxyPublicApiRequest } from '@/core/api/public-proxy';

async function handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDemoMode()) {
    return proxyPublicApiRequest(request, `/api/burials/${id}`);
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ message: 'Demo burials are managed through change requests.' }, { status: 405 });
  }

  const burial = getDemoBurial(Number(id));
  if (!burial) {
    return NextResponse.json({ message: 'Burial not found.' }, { status: 404 });
  }

  return NextResponse.json(burial);
}

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
