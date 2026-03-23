'use client';

import { useState, useCallback } from 'react';
import { Crown, Lock, Loader2 } from 'lucide-react';
import { Badge, Button, Switch } from '@unicore/ui';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { toast } from '@unicore/ui';

const MONTHLY_PRICE = 99;
const ANNUAL_PRICE = 990;
const ANNUAL_SAVINGS = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

interface FeaturePreviewProps {
  /** Feature key, e.g. "sso", "customDomains" */
  feature: string;
  /** Required tier, defaults to "Pro" */
  tier?: string;
  /** Human-readable feature name */
  title: string;
  /** Short description shown in the gate overlay */
  description: string;
  /** Optional blurred preview content shown behind the overlay */
  children?: React.ReactNode;
}

/**
 * Full-page overlay for locked Pro features.
 * Renders `children` blurred in the background with a centered upgrade CTA.
 * When the feature is unlocked, renders children normally.
 */
export function FeaturePreview({
  feature,
  tier = 'Pro',
  title,
  description,
  children,
}: FeaturePreviewProps) {
  const { isPro, hasFeature } = useLicense();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const res = await api.post<{ url: string; sessionId: string }>('/api/v1/license/upgrade', {
        plan: isAnnual ? 'PRO_ANNUAL' : 'PRO_MONTHLY',
        email: user?.email ?? '',
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast({
        title: 'Upgrade failed',
        description: err?.message ?? 'Could not initiate upgrade. Please try again.',
      });
      setIsUpgrading(false);
    }
  }, [isAnnual, user?.email]);

  if (isPro && hasFeature(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[400px] overflow-hidden rounded-xl">
      {/* Blurred preview background */}
      {children && (
        <div
          className="pointer-events-none select-none blur-sm brightness-50 saturate-50"
          aria-hidden="true"
        >
          {children}
        </div>
      )}

      {/* Overlay */}
      <div
        className={`flex flex-col items-center justify-center text-center space-y-6 py-16 px-8 ${
          children
            ? 'absolute inset-0 bg-background/80 backdrop-blur-md'
            : 'min-h-[400px]'
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Crown className="h-8 w-8 text-amber-500" />
        </div>

        <div className="space-y-2 max-w-md">
          <Badge
            variant="secondary"
            className="mb-1 bg-amber-500/10 text-amber-600 border-amber-300/40"
          >
            {tier} Feature
          </Badge>
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Upgrade to {tier} to unlock this feature.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual
          </span>
          {isAnnual && (
            <Badge variant="secondary" className="text-xs">
              Save {ANNUAL_SAVINGS}%
            </Badge>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">${isAnnual ? ANNUAL_PRICE : MONTHLY_PRICE}</span>
          <span className="text-muted-foreground">/{isAnnual ? 'year' : 'month'}</span>
        </div>

        {/* Upgrade button */}
        <Button
          size="lg"
          className="gap-2"
          onClick={handleUpgrade}
          disabled={isUpgrading}
        >
          {isUpgrading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" />
              Upgrade to {tier}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
