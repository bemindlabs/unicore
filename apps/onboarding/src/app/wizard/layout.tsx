import type { ReactNode } from 'react';

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">UniCore</h1>
          <p className="text-muted-foreground mt-1">Setup your workspace</p>
        </div>
        {children}
      </div>
    </div>
  );
}
