import type { ReactNode } from 'react';
import '@unicore/ui/globals.css';

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
