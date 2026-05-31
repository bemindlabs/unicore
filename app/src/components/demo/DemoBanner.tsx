'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const SESSION_KEY = 'demo_banner_dismissed';

/**
 * Top-of-screen banner shown only in the demo tenant (Phase 5 / W3).
 *
 * Demo is how prospects try the multi-tenant SaaS, so the banner frames it as a
 * sandbox and points to a real trial. Dismissal is per-session (sessionStorage)
 * so it reappears on the next visit but stays out of the way during a session.
 *
 * Rendering is gated by the caller (`useDemoMode()` in the dashboard layout);
 * this component only owns the dismiss state.
 */
export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(sessionStorage.getItem(SESSION_KEY) !== '1');
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm"
    >
      <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
      <span className="text-center">
        You&apos;re exploring the UniCore demo — changes are sandboxed and reset
        regularly.{' '}
        <a
          href="https://unicore.bemind.tech/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-amber-800"
        >
          Start your free trial →
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss demo banner"
        className="ml-auto rounded p-0.5 transition-colors hover:bg-amber-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
