'use client';

import { useEffect } from 'react';
import { ExternalLink, Terminal } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bemindlabs/unicore-ui';
import { useLicense } from '@/hooks/use-license';
import { FeaturePreview } from '@/components/license/feature-preview';

const GEEK_PORTAL_URL = process.env.NEXT_PUBLIC_GEEK_PORTAL_URL ?? '/portal/geek';

export default function GeekPage() {
  const { hasFeature } = useLicense();
  const enabled = hasFeature('featGeekCli');

  // Auto-redirect if feature is enabled
  useEffect(() => {
    if (enabled) {
      window.open(GEEK_PORTAL_URL, '_blank', 'noopener,noreferrer');
    }
  }, [enabled]);

  if (!enabled) {
    return (
      <FeaturePreview
        feature="Geek CLI & TUI"
        description="Terminal-first dashboard with XP progression, achievements, leaderboards, multiplayer coding sessions, and CLI plugins."
        requiredTier="pro"
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Geek CLI & TUI</CardTitle>
          <CardDescription>
            Geek runs in its own portal with XP tracking, achievements, leaderboards, multiplayer sessions, and CLI downloads.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button asChild size="lg" className="gap-2 w-full max-w-xs">
            <a href={GEEK_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              <Terminal className="h-4 w-4" />
              Open Geek Portal
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Opens in a new tab
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
