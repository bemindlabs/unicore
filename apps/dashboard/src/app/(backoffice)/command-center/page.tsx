'use client';

import { CommandCenter } from '@/components/backoffice/CommandCenter';

export default function CommandCenterPage() {
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(90deg, transparent 49.5%, #0a162815 49.5%, #0a162815 50.5%, transparent 50.5%) 0 0 / 60px 60px,
            linear-gradient(0deg, transparent 49.5%, #0a162815 49.5%, #0a162815 50.5%, transparent 50.5%) 0 0 / 60px 60px,
            radial-gradient(circle 1.5px, #0d1f3a44 100%, transparent 100%) 0 0 / 60px 60px,
            #060a14
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-cyan-900/30 bg-[#0a0e1a]/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <a
              href="/backoffice"
              className="text-cyan-600/40 hover:text-cyan-400 text-xs transition-colors font-mono"
            >
              &larr; Team Overview
            </a>
            <h1 className="font-mono text-sm lg:text-base text-cyan-400 font-bold tracking-wider uppercase">
              Command Center{' '}
              <span className="text-cyan-600/60 text-[10px]">v1.0</span>
            </h1>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden p-4 lg:p-6">
          <CommandCenter />
        </div>
      </div>
    </div>
  );
}
