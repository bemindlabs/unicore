'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const from = searchParams.get('from') || '/';

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    // Store tokens
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    document.cookie = `auth_token=${accessToken}; path=/; SameSite=Lax`;

    // Verify tokens by fetching user profile
    api
      .get('/auth/me')
      .then(() => {
        router.replace(from);
      })
      .catch(() => {
        // Clean up invalid tokens
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.replace('/login?error=oauth_failed');
      });
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
