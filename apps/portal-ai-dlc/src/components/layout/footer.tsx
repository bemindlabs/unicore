import Link from 'next/link';
import { Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-zinc-50">UniCore AI-DLC</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="https://github.com/bemindlabs/unicore-ai-dlc" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-50">
              GitHub
            </Link>
            <Link href="https://unicore.bemind.tech" className="text-xs text-zinc-400 hover:text-zinc-50">
              UniCore Platform
            </Link>
            <Link href="https://github.com/bemindlabs/unicore-ecosystem/wiki" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-50">
              Docs
            </Link>
          </div>
          <p className="text-xs text-zinc-500">&copy; 2026 BeMind Technology</p>
        </div>
      </div>
    </footer>
  );
}
