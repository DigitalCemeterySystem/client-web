import { NextRequest } from 'next/server';
import { proxyAuthorizedRequest } from '@/core/auth/service-proxy';

async function handler(request: NextRequest) {
  return proxyAuthorizedRequest(request, '/api/biographies', ['MODERATOR', 'ADMIN']);
}

export const GET = handler;
export const POST = handler;
