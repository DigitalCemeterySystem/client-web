import { NextRequest } from 'next/server';
import { proxyChangeRequest } from '@/core/auth/change-request-proxy';

export async function POST(request: NextRequest) {
  return proxyChangeRequest(request, '/api/change-requests/burials/add', 'POST');
}
