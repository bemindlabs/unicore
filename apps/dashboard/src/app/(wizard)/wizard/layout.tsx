import type { ReactNode } from 'react';
import '@unicore/ui/globals.css';

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-3">
            U
          </div>
          <h1 className="text-2xl font-bold tracking-tight">UniCore Setup</h1>
          <p className="text-muted-foreground">Configure your workspace</p>
        </div>
        {children}
      </div>
    </div>
  );
}
