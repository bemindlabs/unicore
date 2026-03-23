'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

export interface LicenseStatus {
  valid: boolean;
  edition: string;
  features: string[];
  maxAgents: number;
  maxRoles: number;
}

interface LicenseContextValue {
  status: LicenseStatus;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_STATUS: LicenseStatus = {
  valid: true,
  edition: 'community',
  features: [],
  maxAgents: 2,
  maxRoles: 3,
};

const CACHE_KEY = 'license_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedLicense {
  data: LicenseStatus;
  timestamp: number;
}

function readCache(): LicenseStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp }: CachedLicense = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: LicenseStatus): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchLicense = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/license/status');
      const edition = res.edition ?? res.tier ?? 'community';
      const data: LicenseStatus = {
        valid: res.valid ?? true,
        edition,
        features: res.features ?? [],
        maxAgents: res.maxAgents ?? (edition === 'pro' ? 50 : 2),
        maxRoles: res.maxRoles ?? (edition === 'pro' ? 20 : 3),
      };
      writeCache(data);
      if (isMounted.current) setStatus(data);
    } catch {
      // silently fall back to cached or default
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // On mount: serve cache immediately, then fetch fresh
  useEffect(() => {
    isMounted.current = true;
    const cached = readCache();
    if (cached) {
      setStatus(cached);
      setLoading(false);
    }
    fetchLicense();
    return () => {
      isMounted.current = false;
    };
  }, [fetchLicense]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => fetchLicense();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchLicense]);

  return (
    <LicenseContext.Provider value={{ status, loading, refresh: fetchLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicenseContext(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenseContext must be used within a LicenseProvider');
  return ctx;
}
