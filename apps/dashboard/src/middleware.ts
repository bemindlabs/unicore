import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isValidToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    return (payload.exp ?? 0) > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Root "/" — redirect to dashboard-home if authenticated, login if not
  if (pathname === '/') {
    if (token && isValidToken(token)) {
      return NextResponse.rewrite(new URL('/dashboard-home', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user has a valid token and visits /login, redirect to dashboard
  if (token && pathname === '/login') {
    if (isValidToken(token)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Token expired — clear it and stay on /login
    const response = NextResponse.next();
    response.cookies.delete('auth_token');
    return response;
  }

  // If no token on a protected route, redirect to /login
  if (!token) {
    return NextResponse.redirect(new URL('/login?from=' + encodeURIComponent(pathname), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|register|wizard|dashboard-home|_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
