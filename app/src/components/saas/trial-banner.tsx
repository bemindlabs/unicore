'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, Crown } from 'lucide-react';
import { Button, cn } from '@bemindlabs/unicore-ui';
import { useSaas } from '@/contexts/saas-context';

/**
 * Trial / subscription banner (M4/E5 — wires the M3 trial spec into the UI).
 *
 * Consumes `GET /api/v1/tenant/subscription` (via {@link useSaas}) and renders:
 *  - a SUSPENDED state (trial expired / subscription canceled → read-only) with
 *    a prominent upgrade CTA, or
 *  - a trial countdown with days-remaining and an "Upgrade" CTA.
 *
 * The CTA initiates the SaaS checkout on the platform (`/api/checkout/saas`),
 * falling back to the public pricing/upgrade flow. Hidden entirely in self-host
 * mode and for non-trialing, non-suspended (already-converted) tenants.
 */

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://unicore.bemind.tech';

function startSaasCheckout(plan: string) {
  const checkoutUrl = `${PLATFORM_URL}/api/checkout/saas`;
  const fallbackUrl = `${PLATFORM_URL}/pricing?upgrade=1&plan=${encodeURIComponent(plan)}`;

  // Prefer a POST to the platform SaaS checkout; on any failure send the user to
  // the public pricing/upgrade page so the upgrade path is never a dead end.
  fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, flowType: 'saas' }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('checkout unavailable');
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      window.location.href = data?.url ?? fallbackUrl;
    })
    .catch(() => {
      window.location.href = fallbackUrl;
    });
}

export function TrialBanner() {
  const { isSaas, subscription, loading } = useSaas();
  const [dismissed, setDismissed] = useState(false);

  // Self-host (open-core) never shows the trial banner.
  if (!isSaas || loading || !subscription) return null;

  const { isTrialing, suspended, trialDaysRemaining, plan } = subscription;

  // Already converted to a paid plan and active → nothing to nudge.
  if (!isTrialing && !suspended) return null;

  // Suspended (trial expired or subscription canceled) → read-only state.
  if (suspended) {
    return (
      <div className="flex items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <strong>Your workspace is read-only.</strong> Your trial has ended or your
          subscription is inactive. Upgrade to restore full access.
        </span>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => startSaasCheckout(plan)}
        >
          <Crown className="mr-1.5 h-3.5 w-3.5" />
          Upgrade now
        </Button>
      </div>
    );
  }

  if (dismissed) return null;

  // Trialing → countdown + upgrade CTA. Tighten the tone as expiry nears.
  const urgent = trialDaysRemaining <= 3;

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2 text-sm',
        urgent
          ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          : 'border-primary/20 bg-primary/5 text-foreground',
      )}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {trialDaysRemaining > 0 ? (
          <>
            <strong>
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left
            </strong>{' '}
            in your free trial. Upgrade any time to keep your workspace running.
          </>
        ) : (
          <>
            <strong>Your trial ends today.</strong> Upgrade now to avoid losing access.
          </>
        )}
      </span>
      <Button size="sm" onClick={() => startSaasCheckout(plan)}>
        <Crown className="mr-1.5 h-3.5 w-3.5" />
        Upgrade
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
