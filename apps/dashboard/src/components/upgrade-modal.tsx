'use client';

import { useState, useCallback } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@unicore/ui';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { toast } from '@unicore/ui';

const MONTHLY_PRICE = 99;
const ANNUAL_PRICE = 990;
const ANNUAL_SAVINGS = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tier required: 'pro' | 'enterprise' */
  requiredTier?: 'pro' | 'enterprise';
  /** Human-readable feature name that triggered the modal */
  featureName?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  requiredTier = 'pro',
  featureName,
}: UpgradeModalProps) {
  const { edition } = useLicense();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const isEnterprise = requiredTier === 'enterprise';

  const handleUpgrade = useCallback(async () => {
    if (isEnterprise) {
      window.open('mailto:sales@bemind.tech?subject=Enterprise%20Inquiry', '_blank');
      return;
    }
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
  }, [isAnnual, user?.email, isEnterprise]);

  const title = isEnterprise ? 'Upgrade to Enterprise' : 'Upgrade to Pro';
  const description = featureName
    ? `${featureName} requires the ${isEnterprise ? 'Enterprise' : 'Pro'} plan.`
    : `This feature requires the ${isEnterprise ? 'Enterprise' : 'Pro'} plan.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Crown className="h-8 w-8 text-amber-500" />
          </div>

          <div className="space-y-1 max-w-xs">
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Current plan: <span className="capitalize">{edition}</span>
            </p>
          </div>

          {!isEnterprise && (
            <>
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

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  ${isAnnual ? ANNUAL_PRICE : MONTHLY_PRICE}
                </span>
                <span className="text-muted-foreground">/{isAnnual ? 'year' : 'month'}</span>
              </div>
            </>
          )}

          {isEnterprise && (
            <p className="text-sm text-muted-foreground max-w-xs">
              Contact our sales team for Enterprise pricing and custom deployment options.
            </p>
          )}

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  {isEnterprise ? 'Contact Sales' : 'Upgrade Now'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
