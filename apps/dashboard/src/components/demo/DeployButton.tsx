'use client';

import { Rocket } from 'lucide-react';

export function DeployButton() {
  return (
    <a
      href="https://unicore.bemind.tech/get-started"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
      aria-label="Deploy your own UniCore instance"
    >
      <Rocket className="h-4 w-4" />
      Deploy Your Own
    </a>
  );
}
