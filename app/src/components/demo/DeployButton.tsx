'use client';

import { Rocket } from 'lucide-react';

/**
 * Floating CTA shown in the demo tenant (Phase 5 / W3) inviting prospects to
 * start a real multi-tenant SaaS trial. Self-host is gone, so this always
 * points at the hosted get-started flow.
 */
export function DeployButton(): JSX.Element {
  return (
    <a
      href="https://unicore.bemind.tech/get-started"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
      aria-label="Start your free UniCore trial"
    >
      <Rocket className="h-4 w-4" />
      Start free trial
    </a>
  );
}
