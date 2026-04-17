import { NextRequest } from 'next/server';
import { proxyAuthorizedRequest } from '@/core/auth/service-proxy';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function handler(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const suffix = path.join('/');
  return proxyAuthorizedRequest(request, suffix ? `/api/search/${suffix}` : '/api/search', ['ADMIN']);
}

export const GET = handler;
export const POST = handler;
