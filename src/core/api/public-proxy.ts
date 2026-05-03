import { NextRequest, NextResponse } from 'next/server';

function resolveApiUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
}

export async function proxyPublicApiRequest(request: NextRequest, backendPath: string) {
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const headers: Record<string, string> = {};
  const contentType = request.headers.get('Content-Type');
  if (contentType && body) {
    headers['Content-Type'] = contentType;
  }

  const backendResponse = await fetch(`${resolveApiUrl()}${backendPath}${request.nextUrl.search}`, {
    method: request.method,
    body,
    headers,
    cache: 'no-store',
  });
  const payload = await backendResponse.arrayBuffer();

  return new NextResponse(payload, {
    status: backendResponse.status,
    headers: {
      'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
    },
  });
}
