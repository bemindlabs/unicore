'use client';

import Link from 'next/link';
import { Zap, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navLinks = [
  { href: '/#features', label: 'Features' },
  { href: '/#agents', label: 'Agents' },
  { href: '/login', label: 'Sign In' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-bold text-zinc-50">UniCore AI-DLC</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors">
              {link.label}
            </Link>
          ))}
          <Link
            href="/register"
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Get Started
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-zinc-800 bg-zinc-950 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="text-sm text-zinc-400 hover:text-zinc-50">
                {link.label}
              </Link>
            ))}
            <Link href="/register" onClick={() => setMobileOpen(false)} className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-500">
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
