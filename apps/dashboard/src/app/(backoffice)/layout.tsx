import type { ReactNode } from 'react';
import '@unicore/ui/globals.css';

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060a14] text-white">{children}</div>
  );
}
