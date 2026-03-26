'use client';

import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { useLicense } from '@/hooks/use-license';
import { FeatureComparisonModal } from './feature-comparison-modal';

const DISMISS_KEY = 'upgrade_banner_dismissed_until';
const DISMISS_DAYS = 7;

export function UpgradeBanner() {
  const { edition } = useLicense();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (edition !== 'community') return;
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) return;
    setVisible(true);
  }, [edition]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400_000));
    setVisible(false);
  }

  if (!visible || edition !== 'community') return null;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-900 dark:bg-zinc-950/40 dark:text-zinc-200">
        <Zap className="h-4 w-4 shrink-0 text-zinc-500" />
        <span>
          You&apos;re on Community.{' '}
          <button
            onClick={() => setModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
          >
            Upgrade to Pro
          </button>{' '}
          for channels, SSO, and more.
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss upgrade banner"
          className="ml-auto rounded p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <FeatureComparisonModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
