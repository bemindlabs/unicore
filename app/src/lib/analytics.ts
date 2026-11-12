/**
 * Lightweight, provider-agnostic funnel analytics for the dashboard.
 *
 * Mirrors `unicore-platform/src/lib/analytics.ts` so signup funnel events are
 * recorded consistently across the public site and the app. Reuses whatever
 * analytics transport is already wired into the dashboard:
 *  - the existing Google Analytics / gtag tag (configured via the Firebase
 *    `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`, see `@/lib/firebase` +
 *    `@/components/analytics`);
 *  - an optional generic HTTP endpoint (`NEXT_PUBLIC_ANALYTICS_ENDPOINT`) for a
 *    vendor of your choice (PostHog/Plausible/self-hosted collector).
 *
 * `track()` is a safe no-op unless at least one transport is configured, so it is
 * always safe to call from CTAs without leaking events in environments (CI,
 * self-host, dev) that have no analytics key/endpoint set.
 *
 * No vendor SDK is added. If a consent banner is ever introduced, gate
 * `isEnabled()` on it here in one place.
 */

import { GA_MEASUREMENT_ID } from '@/lib/firebase';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Canonical signup -> trial -> convert funnel stages. */
export type FunnelEvent =
  | 'signup_started'
  | 'trial_started' // a.k.a. signup_completed (fires when card-less signup succeeds)
  | 'upgrade_clicked'
  | 'checkout_started'
  | 'checkout_completed';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/** Optional generic collector endpoint — vendor-agnostic, opt-in via env. */
const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;

/** Analytics is active only when a transport is configured. */
function isEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID || ANALYTICS_ENDPOINT);
}

/**
 * Record a funnel event. Safe to call from anywhere on the client; no-ops on the
 * server and when no analytics transport is configured.
 */
export function track(event: FunnelEvent, props?: AnalyticsProps): void {
  if (typeof window === 'undefined' || !isEnabled()) return;

  // 1) Reuse the existing gtag tag if it loaded.
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, { ...props });
  }

  // 2) Optional generic collector (fire-and-forget, never blocks the UI).
  if (ANALYTICS_ENDPOINT) {
    try {
      const body = JSON.stringify({ event, props: props ?? {}, ts: Date.now() });
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
      } else {
        void fetch(ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* analytics must never break the funnel */
    }
  }
}
