'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const SESSION_KEY = 'demo_banner_dismissed';

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(SESSION_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm">
      <span>
        Demo Mode — data resets every 24h. Deploy your own →{' '}
        <a
          href="https://unicore.bemind.tech/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-amber-800 transition-colors"
        >
          unicore.bemind.tech/get-started
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss demo banner"
        className="ml-auto rounded p-0.5 hover:bg-amber-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
