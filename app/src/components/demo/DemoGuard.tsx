'use client';

import { Rocket } from 'lucide-react';

/**
 * Full-section placeholder shown in place of a page that is unavailable in the
 * demo tenant (Phase 5 / W3). Self-host is gone, so the CTA points prospects at
 * a real hosted trial. Usage: `if (demoMode) return <DemoGuard />;`
 */
export function DemoGuard(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-12 text-center dark:border-amber-800/40 dark:bg-amber-950/20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
        <Rocket className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          Not available in the demo
        </h2>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
          Billing and account settings are disabled in the sandbox. Start a free
          trial to manage your own business.
        </p>
      </div>
      <a
        href="https://unicore.bemind.tech/get-started"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 transition-colors"
      >
        Start free trial →
      </a>
    </div>
  );
}
