import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground text-primary font-bold text-lg">
            U
          </div>
          <span className="text-xl font-semibold">UniCore</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            AI-powered business operations, unified.
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            Manage your agents, workflows, and ERP modules from a single platform.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          BeMind Technology
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
        {children}
      </div>
    </div>
  );
}
