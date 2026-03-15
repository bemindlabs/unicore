'use client';

import type { ErpModulesConfig } from '@unicore/shared-types';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  cn,
} from '@unicore/ui';

import { useWizardState } from '@/hooks/use-wizard-state';
import { ERP_MODULES } from '@/types/wizard';

export function StepErp() {
  const { state, dispatch } = useWizardState();

  function toggleModule(key: keyof ErpModulesConfig) {
    dispatch({ type: 'UPDATE_ERP', modules: { [key]: !state.erp[key] } });
  }

  const enabledCount = Object.values(state.erp).filter(Boolean).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ERP Modules</h2>
        <p className="text-muted-foreground mt-1">
          Enable or disable ERP modules based on your business needs.
        </p>
        <Badge variant="secondary" className="mt-2">
          {enabledCount} of {ERP_MODULES.length} modules enabled
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ERP_MODULES.map((mod) => (
          <Card
            key={mod.key}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              state.erp[mod.key] && 'border-primary/30 shadow-sm',
              !state.erp[mod.key] && 'opacity-60',
            )}
            onClick={() => toggleModule(mod.key)}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{mod.label}</CardTitle>
                <Switch
                  checked={state.erp[mod.key]}
                  onCheckedChange={() => toggleModule(mod.key)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CardDescription className="text-xs">{mod.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
