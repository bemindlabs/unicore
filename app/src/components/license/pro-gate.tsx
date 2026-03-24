'use client';

import type { ReactNode } from 'react';
import { useProFeature } from '@/hooks/use-license';
import { UpgradePrompt } from './upgrade-prompt';

interface ProGateProps {
  /** Feature flag key, e.g. "sso", "rbac", "customDomains" */
  feature: string;
  /** Human-readable feature name for the upgrade prompt */
  featureName?: string;
  /** Target tier required */
  targetTier?: 'Pro' | 'Enterprise';
  /** Custom description for the upgrade prompt */
  description?: string;
  /** Content rendered when the feature is enabled */
  children: ReactNode;
}

export function ProGate({
  feature,
  featureName,
  targetTier = 'Pro',
  description,
  children,
}: ProGateProps) {
  const { enabled } = useProFeature(feature);

  if (enabled) return <>{children}</>;

  return (
    <UpgradePrompt
      feature={featureName ?? feature}
      targetTier={targetTier}
      description={description}
    />
  );
}
