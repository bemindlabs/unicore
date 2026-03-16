import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // If user has a token and visits /login, redirect to dashboard
  // But only if the token looks valid (has 3 JWT parts and isn't expired)
  if (token && pathname === '/login') {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp ?? 0;
        if (exp > Date.now() / 1000) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    } catch {
      // Token is malformed — let them stay on /login
    }
    // Token expired or invalid — clear it and stay on /login
    const response = NextResponse.next();
    response.cookies.delete('auth_token');
    return response;
  }

  // If no token on a protected route, redirect to /landing
  if (!token) {
    const landingUrl = new URL('/landing', request.url);
    landingUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(landingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|landing|register|wizard|_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
