'use client';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  cn,
} from '@bemindlabs/unicore-ui';
import { useEffect } from 'react';

import { useWizardState } from '@/hooks/use-wizard-state';
import { INTEGRATION_CATEGORIES } from '@/types/wizard';

export function StepIntegrations() {
  const { state, dispatch } = useWizardState();

  // Initialize integrations list from catalog on first render
  useEffect(() => {
    if (state.integrations.length > 0) return;
    const all = INTEGRATION_CATEGORIES.flatMap((cat) =>
      cat.integrations.map((int) => ({
        name: int.name,
        provider: int.provider,
        enabled: false,
        config: {},
      })),
    );
    dispatch({ type: 'SET_INTEGRATIONS', integrations: all });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function findIntegrationIndex(provider: string): number {
    return state.integrations.findIndex((i) => i.provider === provider);
  }

  const enabledCount = state.integrations.filter((i) => i.enabled).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect external services to extend your workspace capabilities.
        </p>
        <Badge variant="secondary" className="mt-2">
          {enabledCount} integration{enabledCount !== 1 ? 's' : ''} enabled
        </Badge>
      </div>

      <div className="space-y-6">
        {INTEGRATION_CATEGORIES.map((cat) => (
          <div key={cat.category}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {cat.category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat.integrations.map((int) => {
                const idx = findIntegrationIndex(int.provider);
                const enabled = idx >= 0 && state.integrations[idx].enabled;
                return (
                  <Card
                    key={int.provider}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/50',
                      enabled && 'border-primary/30 shadow-sm',
                      !enabled && 'opacity-60',
                    )}
                    onClick={() => idx >= 0 && dispatch({ type: 'TOGGLE_INTEGRATION', index: idx })}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{int.name}</CardTitle>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() =>
                            idx >= 0 && dispatch({ type: 'TOGGLE_INTEGRATION', index: idx })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <CardDescription className="text-xs">{int.description}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
