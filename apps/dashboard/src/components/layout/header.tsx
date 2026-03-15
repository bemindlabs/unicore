'use client';

import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { Button, Input } from '@unicore/ui';
import { useTheme } from '@/hooks/use-theme';
import { Breadcrumb } from '@/components/layout/breadcrumb';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card/30 backdrop-blur-sm px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>

      <Breadcrumb />

      <div className="flex-1" />

      <div className="hidden md:flex items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 w-48 bg-muted/50 border-0 pl-8 text-sm placeholder:text-muted-foreground/60 focus-visible:w-64 transition-all"
          />
        </div>
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <Button variant="ghost" size="icon" className="relative h-8 w-8">
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
      </Button>
    </header>
  );
}
