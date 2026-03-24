'use client';

import { useCallback, useContext } from 'react';
import { AuthContext } from '@/components/auth/auth-provider';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const auth = useAuth();

  const requireRole = useCallback(
    (roles: string[]) => {
      if (!auth.user) return false;
      return roles.includes('*') || roles.includes(auth.user.role);
    },
    [auth.user],
  );

  return { ...auth, requireRole };
}
