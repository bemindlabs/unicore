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

  // Root "/" — show landing for guests, dashboard for logged-in users
  if (pathname === '/') {
    if (token && isValidToken(token)) {
      // Authenticated → rewrite to dashboard (internal, no redirect)
      return NextResponse.rewrite(new URL('/dashboard-home', request.url));
    }
    // Not authenticated → rewrite to landing page
    return NextResponse.rewrite(new URL('/landing', request.url));
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

  // If no token on a protected route, redirect to /landing
  if (!token) {
    return NextResponse.redirect(new URL('/landing?from=' + encodeURIComponent(pathname), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!landing|login|register|wizard|dashboard-home|_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
