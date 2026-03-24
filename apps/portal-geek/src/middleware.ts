import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register'];
const PUBLIC_PREFIXES = ['/_next/', '/favicon.ico', '/api/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    );
    if (!payload.exp) return false;
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('geek_token')?.value;
  const hasValidToken = token ? isTokenValid(token) : false;

  // Authenticated user visiting /login → redirect to portal
  if (pathname === '/login' && hasValidToken) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  // Public paths → allow through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protected /portal/* routes → require valid token
  if (pathname.startsWith('/portal') && !hasValidToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
