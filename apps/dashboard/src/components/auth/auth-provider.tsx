'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@unicore/shared-types';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  avatarUrl?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

function getJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function syncCookie(token: string | null): void {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
  } else {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

async function attemptRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return null;
  try {
    const res = await api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken: rt },
    );
    localStorage.setItem('auth_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
    syncCookie(res.accessToken);
    return res;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (token: string) => {
      clearTimer();
      const exp = getJwtExp(token);
      if (!exp) return;
      const ms = (exp - Math.floor(Date.now() / 1000) - 120) * 1000;
      if (ms <= 0) {
        attemptRefresh().then((res) => res && scheduleRefresh(res.accessToken));
        return;
      }
      timerRef.current = setTimeout(async () => {
        const res = await attemptRefresh();
        if (res) scheduleRefresh(res.accessToken);
      }, ms);
    },
    [clearTimer],
  );

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      syncCookie(token);
      api
        .get<AuthUser>('/auth/me')
        .then((res) => {
          setUser(res);
          scheduleRefresh(token);
        })
        .catch(async () => {
          const refreshed = await attemptRefresh();
          if (refreshed) {
            try {
              const me = await api.get<AuthUser>('/auth/me');
              setUser(me);
              scheduleRefresh(refreshed.accessToken);
              return;
            } catch {
              /* fall through */
            }
          }
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          syncCookie(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    return () => clearTimer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: AuthUser;
      }>('/auth/login', { email, password });
      localStorage.setItem('auth_token', res.accessToken);
      localStorage.setItem('refresh_token', res.refreshToken);
      syncCookie(res.accessToken);
      setUser(res.user);
      scheduleRefresh(res.accessToken);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(() => {
    clearTimer();
    const rt = localStorage.getItem('refresh_token');
    if (rt) api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    syncCookie(null);
    setUser(null);
  }, [clearTimer]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
