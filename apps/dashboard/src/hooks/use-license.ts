'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLicenseContext } from '@/contexts/license-context';
import { toast } from '@unicore/ui';

interface UseLicenseOptions {
  /** When true and URL has ?upgraded=true, poll for edition change */
  pollOnUpgrade?: boolean;
}

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 120000;

export function useLicense(options: UseLicenseOptions = {}) {
  const { pollOnUpgrade = false } = options;
  const { status, loading, refresh } = useLicenseContext();
  const [isPolling, setIsPolling] = useState(false);
  const [upgradeDetected, setUpgradeDetected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // UPG-5: Poll on upgrade
  useEffect(() => {
    if (!pollOnUpgrade) return;
    if (searchParams.get('upgraded') !== 'true') return;

    setIsPolling(true);

    pollRef.current = setInterval(async () => {
      await refresh();
      if (status.edition === 'pro' || status.edition === 'enterprise') {
        setIsPolling(false);
        setUpgradeDetected(true);
        toast({ title: 'Pro activated!', description: 'All features are now unlocked.' });
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('upgraded');
        const q = params.toString();
        router.replace(q ? `?${q}` : window.location.pathname);
      }
    }, POLL_INTERVAL);

    timeoutRef.current = setTimeout(() => {
      setIsPolling(false);
      if (pollRef.current) clearInterval(pollRef.current);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('upgraded');
      const q = params.toString();
      router.replace(q ? `?${q}` : window.location.pathname);
    }, POLL_TIMEOUT);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pollOnUpgrade, searchParams, refresh, router, status.edition]);

  const tier = status.edition;
  const isPro = tier === 'pro' || tier === 'enterprise';
  const isFeatureEnabled = useCallback((flag: string) => isPro || status.features.includes(flag), [isPro, status.features]);

  return {
    // new API
    tier,
    features: status.features,
    isFeatureEnabled,
    loading,
    // backward-compat aliases
    edition: status.edition,
    valid: status.valid,
    maxAgents: status.maxAgents,
    maxRoles: status.maxRoles,
    isPro,
    hasFeature: isFeatureEnabled,
    isPolling,
    upgradeDetected,
    refetch: refresh,
  };
}

export function useProFeature(flag: string) {
  const { isFeatureEnabled } = useLicense();
  const enabled = isFeatureEnabled(flag);
  return { enabled, showUpgrade: !enabled };
}
