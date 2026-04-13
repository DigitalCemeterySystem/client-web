import { NextRequest } from 'next/server';
import { proxyChangeRequest } from '@/core/auth/change-request-proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  return proxyChangeRequest(request, `/api/change-requests/${requestId}/draft`, 'PUT');
}
