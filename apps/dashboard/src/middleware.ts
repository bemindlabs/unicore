import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'th', 'ja', 'zh', 'es', 'fr', 'de'];
const DEFAULT_LOCALE = 'en';

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

function resolveLocale(request: NextRequest): string {
  // 1. Check locale cookie (set by dashboard when user picks language)
  const cookieLocale = request.cookies.get('locale')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0]?.split('-')[0]?.trim();
    if (preferred && SUPPORTED_LOCALES.includes(preferred)) {
      return preferred;
    }
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Resolve locale and ensure the cookie is set
  const locale = resolveLocale(request);

  function withLocale(response: NextResponse): NextResponse {
    if (!request.cookies.get('locale')?.value) {
      response.cookies.set('locale', locale, { path: '/', sameSite: 'lax' });
    }
    return response;
  }

  // Root "/" — serve dashboard if authenticated, login if not
  if (pathname === '/') {
    if (token && isValidToken(token)) {
      return withLocale(NextResponse.next());
    }
    return withLocale(NextResponse.redirect(new URL('/login', request.url)));
  }

  // If user has a valid token and visits /login, redirect to dashboard
  if (token && pathname === '/login') {
    if (isValidToken(token)) {
      return withLocale(NextResponse.redirect(new URL('/', request.url)));
    }
    // Token expired — clear it and stay on /login
    const response = NextResponse.next();
    response.cookies.delete('auth_token');
    return withLocale(response);
  }

  // If no token on a protected route, redirect to /login
  if (!token) {
    return withLocale(
      NextResponse.redirect(new URL('/login?from=' + encodeURIComponent(pathname), request.url)),
    );
  }

  return withLocale(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!login|register|wizard|_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
