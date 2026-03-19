'use client';

import { useState, useCallback } from 'react';
import { Crown, Lock, Loader2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Switch } from '@unicore/ui';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { toast } from '@unicore/ui';

const MONTHLY_PRICE = 99;
const ANNUAL_PRICE = 990;
const ANNUAL_SAVINGS = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

interface UpgradeGateProps {
  /** Feature key, e.g. "sso", "rbac", "customDomains" */
  feature: string;
  /** Human-readable feature name, e.g. "Single Sign-On" */
  featureTitle: string;
  /** Short description of what the feature does */
  featureDescription: string;
  /** Content to render when the feature is unlocked */
  children: React.ReactNode;
}

export function UpgradeGate({
  feature,
  featureTitle,
  featureDescription,
  children,
}: UpgradeGateProps) {
  const { isPro, hasFeature } = useLicense();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const res = await api.post<{ checkoutUrl: string }>('/api/v1/license/upgrade', {
        plan: isAnnual ? 'pro-annual' : 'pro-monthly',
        email: user?.email ?? '',
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
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
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Crown className="h-8 w-8 text-amber-500" />
        </div>

        <div className="space-y-2 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{featureTitle}</h2>
          </div>
          <p className="text-muted-foreground">{featureDescription}</p>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Upgrade to Pro to unlock this feature.
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
              Upgrade to Pro
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
