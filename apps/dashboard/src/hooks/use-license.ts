'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@unicore/ui';

interface LicenseStatus {
  valid: boolean;
  tier: string;
  features: string[];
  maxAgents: number;
  maxRoles: number;
}

interface UseLicenseOptions {
  /** When true and URL has ?upgraded=true, poll for tier change */
  pollOnUpgrade?: boolean;
}

const DEFAULT: LicenseStatus = { valid: true, tier: 'community', features: [], maxAgents: 2, maxRoles: 3 };

const POLL_INTERVAL = 5000; // 5 seconds
const POLL_TIMEOUT = 120000; // 2 minutes

export function useLicense(options: UseLicenseOptions = {}) {
  const { pollOnUpgrade = false } = options;
  const [license, setLicense] = useState<LicenseStatus>(DEFAULT);
  const [isPolling, setIsPolling] = useState(false);
  const [upgradeDetected, setUpgradeDetected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchLicense = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/license/status');
      const status: LicenseStatus = {
        valid: res.valid ?? true,
        tier: res.tier ?? 'community',
        features: res.features ?? [],
        maxAgents: res.maxAgents ?? (res.tier === 'pro' ? 50 : 2),
        maxRoles: res.maxRoles ?? (res.tier === 'pro' ? 20 : 3),
      };
      setLicense(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  // UPG-5: Poll on upgrade
  useEffect(() => {
    if (!pollOnUpgrade) return;

    const upgraded = searchParams.get('upgraded');
    if (upgraded !== 'true') return;

    setIsPolling(true);

    pollRef.current = setInterval(async () => {
      const status = await fetchLicense();
      if (status && (status.tier === 'pro' || status.tier === 'enterprise')) {
        // Upgrade detected
        setIsPolling(false);
        setUpgradeDetected(true);
        toast({
          title: 'Pro activated!',
          description: 'All features are now unlocked.',
        });

        // Clean up polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Remove ?upgraded=true from URL
        const params = new URLSearchParams(searchParams.toString());
        params.delete('upgraded');
        const newQuery = params.toString();
        router.replace(newQuery ? `?${newQuery}` : window.location.pathname);
      }
    }, POLL_INTERVAL);

    // Timeout after 2 minutes
    timeoutRef.current = setTimeout(() => {
      setIsPolling(false);
      if (pollRef.current) clearInterval(pollRef.current);

      // Remove ?upgraded=true from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('upgraded');
      const newQuery = params.toString();
      router.replace(newQuery ? `?${newQuery}` : window.location.pathname);
    }, POLL_TIMEOUT);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pollOnUpgrade, searchParams, fetchLicense, router]);

  const isPro = license.tier === 'pro' || license.tier === 'enterprise';
  const hasFeature = (f: string) => isPro || license.features.includes(f);

  return { ...license, isPro, hasFeature, isPolling, upgradeDetected, refetch: fetchLicense };
}
