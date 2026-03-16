'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LicenseStatus {
  valid: boolean;
  tier: string;
  features: string[];
  maxAgents: number;
  maxRoles: number;
}

const DEFAULT: LicenseStatus = { valid: true, tier: 'community', features: [], maxAgents: 2, maxRoles: 3 };

export function useLicense() {
  const [license, setLicense] = useState<LicenseStatus>(DEFAULT);

  useEffect(() => {
    api.get<any>('/api/v1/license/status')
      .then((res) => setLicense({
        valid: res.valid ?? true,
        tier: res.tier ?? 'community',
        features: res.features ?? [],
        maxAgents: res.maxAgents ?? (res.tier === 'pro' ? 50 : 2),
        maxRoles: res.maxRoles ?? (res.tier === 'pro' ? 20 : 3),
      }))
      .catch(() => {}); // Keep defaults
  }, []);

  const isPro = license.tier === 'pro' || license.tier === 'enterprise';
  const hasFeature = (f: string) => isPro || license.features.includes(f);

  return { ...license, isPro, hasFeature };
}
