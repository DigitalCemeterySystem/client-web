import { NextRequest } from 'next/server';
import { proxyChangeRequest } from '@/core/auth/change-request-proxy';

export async function GET(request: NextRequest) {
  return proxyChangeRequest(request, '/api/change-requests/my', 'GET');
}
