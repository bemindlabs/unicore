'use client';

import { Crown, Lock } from 'lucide-react';
import { Button, Card, CardContent } from '@bemindlabs/unicore-ui';

interface UpgradePromptProps {
  /** Human-readable feature name, e.g. "Single Sign-On" */
  feature: string;
  /** Target tier required to unlock this feature */
  targetTier?: 'Pro' | 'Enterprise';
  /** Optional description override */
  description?: string;
}

const PRICING_URL = 'https://unicore.bemind.tech/#pricing';

export function UpgradePrompt({
  feature,
  targetTier = 'Pro',
  description,
}: UpgradePromptProps): JSX.Element {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <Lock className="h-7 w-7 text-amber-500" />
        </div>

        <div className="space-y-2 max-w-sm">
          <h3 className="text-lg font-semibold">{feature} requires {targetTier}</h3>
          <p className="text-sm text-muted-foreground">
            {description ?? `Upgrade to ${targetTier} to unlock ${feature} and other premium features.`}
          </p>
        </div>

        <Button asChild size="sm" className="gap-2">
          <a href={PRICING_URL} target="_blank" rel="noreferrer">
            <Crown className="h-4 w-4" />
            Upgrade to {targetTier}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
