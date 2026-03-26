'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, Separator, Sheet, SheetContent, SheetHeader, SheetTitle } from '@bemindlabs/unicore-ui';
import { useAuth } from '@/hooks/use-auth';
import { useLicense } from '@/hooks/use-license';
import { useBranding } from '@/components/BrandingProvider';
import { filterSectionsByRole, isNavItemLocked } from '@/lib/navigation';

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps): JSX.Element {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isPro, edition, hasFeature } = useLicense();
  const { config } = useBranding();
  const appName = config?.appName ?? 'UniCore';
  const sections = user ? filterSectionsByRole(user.role) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0 flex flex-col h-full">
        <SheetHeader className="border-b px-4 py-3 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold" data-unicore-branding>
              {appName[0] ?? 'U'}
            </div>
            <span className="text-base font-semibold" data-unicore-branding>{appName}</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
          {sections
            .filter((section) =>
              section.items.some((item) => !isNavItemLocked(item, isPro, edition, hasFeature)),
            )
            .map((section, idx) => (
            <div key={section.label} className={cn(idx > 0 && 'mt-3')}>
              <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
              {idx > 0 && <Separator className="mb-2" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const locked = isNavItemLocked(item, isPro, edition, hasFeature);

                  if (locked) {
                    return null;
                  }

                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
