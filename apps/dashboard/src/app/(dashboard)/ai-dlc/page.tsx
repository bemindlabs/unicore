'use client';

import { useEffect } from 'react';
import { ExternalLink, Zap } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bemindlabs/unicore-ui';
import { useLicense } from '@/hooks/use-license';
import { FeaturePreview } from '@/components/license/feature-preview';

const DLC_PORTAL_URL = process.env.NEXT_PUBLIC_DLC_PORTAL_URL ?? '/portal/ai-dlc';

export default function AiDlcPage() {
  const { hasFeature } = useLicense();
  const enabled = hasFeature('featAiDlc');

  // Auto-redirect if feature is enabled
  useEffect(() => {
    if (enabled) {
      window.open(DLC_PORTAL_URL, '_blank', 'noopener,noreferrer');
    }
  }, [enabled]);

  if (!enabled) {
    return (
      <FeaturePreview
        feature="AI Developer Lifecycle Chat"
        description="Collaborate with AI specialist agents (Architect, Developer, Tester, DevOps, PM) in real-time chat rooms for your entire software development lifecycle."
        requiredTier="pro"
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>AI Developer Lifecycle Chat</CardTitle>
          <CardDescription>
            AI-DLC runs in its own portal with dedicated chat rooms, SDLC agents, and real-time collaboration.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button asChild size="lg" className="gap-2 w-full max-w-xs">
            <a href={DLC_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              <Zap className="h-4 w-4" />
              Open AI-DLC Portal
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
