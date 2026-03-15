import type { ReactNode } from 'react';

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Setup Wizard</h1>
        <p className="text-muted-foreground">Configure your UniCore workspace</p>
      </div>
      {children}
    </div>
  );
}
