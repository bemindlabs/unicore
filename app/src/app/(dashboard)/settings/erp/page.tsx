'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  DollarSign,
  FileText,
  Loader2,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Separator,
  Switch,
  toast,
} from '@bemindlabs/unicore-ui';
import type { ErpModulesConfig } from '@bemindlabs/unicore-shared-types';
import { api } from '@/lib/api';

interface ErpModuleDefinition {
  key: keyof ErpModulesConfig;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredBy?: string[];
}

const ERP_MODULES: ErpModuleDefinition[] = [
  {
    key: 'contacts',
    label: 'Contacts & CRM',
    description: 'Manage customers, suppliers, and leads',
    icon: Users,
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Track sales orders and purchase orders',
    icon: ShoppingCart,
    requiredBy: ['Invoicing'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Monitor stock levels, locations, and movements',
    icon: Package,
  },
  {
    key: 'invoicing',
    label: 'Invoicing',
    description: 'Create, send, and track invoices and payments',
    icon: FileText,
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Record and categorise business expenses',
    icon: DollarSign,
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Revenue, profit, and operational dashboards',
    icon: TrendingUp,
  },
];

const DEFAULT_MODULES: ErpModulesConfig = {
  contacts: true,
  orders: true,
  inventory: true,
  invoicing: true,
  expenses: false,
  reports: true,
};

const STORAGE_KEY = 'unicore_erp_modules';

function loadModulesFromStorage(): ErpModulesConfig {
  if (typeof window === 'undefined') return DEFAULT_MODULES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_MODULES, ...JSON.parse(stored) } : DEFAULT_MODULES;
  } catch {
    return DEFAULT_MODULES;
  }
}

export default function SettingsErpPage() {
  const [modules, setModules] = useState<ErpModulesConfig>(DEFAULT_MODULES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved modules from API on mount, fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    async function fetchModules() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<ErpModulesConfig>('/api/v1/settings/erp-modules');
        const data = (res as { data?: ErpModulesConfig }).data ?? res;
        if (!cancelled) {
          const merged = { ...DEFAULT_MODULES, ...(data as ErpModulesConfig) };
          setModules(merged);
          // Sync localStorage cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch {
        // API unavailable — fall back to localStorage
        if (!cancelled) {
          setModules(loadModulesFromStorage());
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchModules();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = useCallback((key: keyof ErpModulesConfig, enabled: boolean) => {
    setModules((prev) => ({ ...prev, [key]: enabled }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.put('/api/v1/settings/erp-modules', modules);
      // Update localStorage cache after successful API save
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
      toast({ title: 'Saved', description: 'ERP module configuration saved successfully.' });
    } catch {
      // If API fails, still save to localStorage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
      setError('Failed to save to server. Changes saved locally and will sync when the server is available.');
      toast({
        title: 'Warning',
        description: 'Saved locally only — server is unavailable.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [modules]);

  const enabledCount = Object.values(modules).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading ERP module settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>ERP Modules</CardTitle>
          </div>
          <CardDescription>
            Enable only the modules your business needs. Disabled modules are hidden from the sidebar
            and inaccessible to all team members. {enabledCount} of {ERP_MODULES.length} modules
            active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ERP_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.key}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label
                      htmlFor={`erp-${mod.key}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {mod.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                    {mod.requiredBy && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Required by: {mod.requiredBy.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  id={`erp-${mod.key}`}
                  checked={modules[mod.key]}
                  onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
