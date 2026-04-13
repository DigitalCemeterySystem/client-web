import { NextRequest } from 'next/server';
import { proxyChangeRequest } from '@/core/auth/change-request-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ burialId: string }> }
) {
  const { burialId } = await params;
  return proxyChangeRequest(request, `/api/change-requests/burials/${burialId}/edit`, 'POST');
}
