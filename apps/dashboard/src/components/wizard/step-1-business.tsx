'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@unicore/ui';
import type { BusinessTemplate } from '@unicore/shared-types';

import { useWizardState } from '@/hooks/use-wizard-state';
import {
  AVAILABLE_CURRENCIES,
  AVAILABLE_LANGUAGES,
  AVAILABLE_TIMEZONES,
  BUSINESS_TEMPLATES,
} from '@/types/wizard';

export function StepBusiness() {
  const { state, dispatch } = useWizardState();
  const { business } = state;

  function updateField<K extends keyof typeof business>(key: K, value: (typeof business)[K]) {
    dispatch({ type: 'UPDATE_BUSINESS', data: { [key]: value } });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business Profile</h2>
        <p className="text-muted-foreground mt-1">
          Choose your business type and configure basic settings.
        </p>
      </div>

      {/* Business Type Cards */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Business Type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUSINESS_TEMPLATES.map((tmpl) => (
            <Card
              key={tmpl.value}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                business.template === tmpl.value && 'border-primary ring-2 ring-primary/20',
              )}
              onClick={() => updateField('template', tmpl.value as BusinessTemplate)}
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">{tmpl.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <CardDescription className="text-xs">{tmpl.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="business-name">Business Name</Label>
        <Input
          id="business-name"
          placeholder="My Awesome Business"
          value={business.name}
          onChange={(e) => updateField('name', e.target.value)}
          maxLength={100}
        />
      </div>

      {/* Selectors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={business.currency} onValueChange={(v) => updateField('currency', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={business.locale} onValueChange={(v) => updateField('locale', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={business.timezone} onValueChange={(v) => updateField('timezone', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
