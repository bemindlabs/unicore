'use client';

import { useCallback, useState } from 'react';
import { Bot, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  toast,
} from '@unicore/ui';
import { AgentType, AutonomyLevel } from '@unicore/shared-types';
import type { AgentConfig, AgentChannel } from '@unicore/shared-types';
import { Breadcrumb } from '@/components/layout/breadcrumb';

const AGENT_LABELS: Record<AgentType, string> = {
  [AgentType.Router]: 'Router Agent',
  [AgentType.Comms]: 'Comms Agent',
  [AgentType.Finance]: 'Finance Agent',
  [AgentType.Growth]: 'Growth Agent',
  [AgentType.Ops]: 'Ops Agent',
  [AgentType.Research]: 'Research Agent',
  [AgentType.Erp]: 'ERP Agent',
  [AgentType.Builder]: 'Builder Agent',
};

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  [AgentType.Router]: 'Classifies and routes incoming messages to the right agent',
  [AgentType.Comms]: 'Handles customer communication across all channels',
  [AgentType.Finance]: 'Monitors cash flow, invoices, and financial health',
  [AgentType.Growth]: 'Runs campaigns, tracks metrics, and identifies growth opportunities',
  [AgentType.Ops]: 'Manages day-to-day operations and task scheduling',
  [AgentType.Research]: 'Researches competitors, trends, and market intelligence',
  [AgentType.Erp]: 'Automates ERP data entry, orders, and inventory updates',
  [AgentType.Builder]: 'Builds and modifies workflows and automations',
};

const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  [AutonomyLevel.FullAuto]: 'Full Auto',
  [AutonomyLevel.Approval]: 'Requires Approval',
  [AutonomyLevel.Suggest]: 'Suggest Only',
};

const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  [AutonomyLevel.FullAuto]: 'Agent acts immediately without confirmation',
  [AutonomyLevel.Approval]: 'Agent proposes action and waits for your approval',
  [AutonomyLevel.Suggest]: 'Agent surfaces recommendations for you to act on',
};

const ALL_CHANNELS: AgentChannel[] = [
  'line',
  'facebook',
  'instagram',
  'web',
  'email',
  'sms',
  'slack',
  'whatsapp',
];

const CHANNEL_LABELS: Record<AgentChannel, string> = {
  line: 'LINE',
  facebook: 'Facebook',
  instagram: 'Instagram',
  web: 'Web Chat',
  email: 'Email',
  sms: 'SMS',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
};

const DEFAULT_AGENT_CONFIGS: AgentConfig[] = (Object.values(AgentType) as AgentType[]).map(
  (type) => ({
    type,
    enabled: type === AgentType.Router || type === AgentType.Comms,
    autonomy: AutonomyLevel.Approval,
    channels:
      type === AgentType.Comms
        ? (['web', 'email'] satisfies AgentChannel[])
        : [],
  }),
);

export default function SettingsAgentsPage() {
  const [configs, setConfigs] = useState<AgentConfig[]>(DEFAULT_AGENT_CONFIGS);
  const [isSaving, setIsSaving] = useState(false);

  const updateConfig = useCallback(
    (type: AgentType, patch: Partial<AgentConfig>) => {
      setConfigs((prev) =>
        prev.map((c) => (c.type === type ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const toggleChannel = useCallback(
    (type: AgentType, channel: AgentChannel, checked: boolean) => {
      setConfigs((prev) =>
        prev.map((c) => {
          if (c.type !== type) return c;
          const channels = checked
            ? [...(c.channels ?? []), channel]
            : (c.channels ?? []).filter((ch) => ch !== channel);
          return { ...c, channels };
        }),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // TODO: api.put('/settings/agents', configs)
      await new Promise((r) => setTimeout(r, 600));
      toast({ title: 'Saved', description: 'Agent configuration updated.' });
    } finally {
      setIsSaving(false);
    }
  }, [configs]);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>AI Agent Configuration</CardTitle>
          </div>
          <CardDescription>
            Enable agents and configure their autonomy level and active channels. Pro edition unlocks
            all 8 agents and additional channels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {configs.map((config) => (
            <div key={config.type} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`agent-${config.type}`}
                    checked={config.enabled}
                    onCheckedChange={(enabled) => updateConfig(config.type, { enabled })}
                  />
                  <div>
                    <Label
                      htmlFor={`agent-${config.type}`}
                      className="cursor-pointer font-medium"
                    >
                      {AGENT_LABELS[config.type]}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {AGENT_DESCRIPTIONS[config.type]}
                    </p>
                  </div>
                </div>
                {config.enabled && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    <Zap className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                )}
              </div>

              {config.enabled && (
                <div className="ml-10 space-y-4 rounded-lg border p-4">
                  {/* Autonomy */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Autonomy Level
                    </Label>
                    <Select
                      value={config.autonomy}
                      onValueChange={(v) =>
                        updateConfig(config.type, { autonomy: v as AutonomyLevel })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.values(AutonomyLevel) as AutonomyLevel[]).map((level) => (
                          <SelectItem key={level} value={level}>
                            <div>
                              <p className="font-medium">{AUTONOMY_LABELS[level]}</p>
                              <p className="text-xs text-muted-foreground">
                                {AUTONOMY_DESCRIPTIONS[level]}
                              </p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Channels (only for Comms-type agents) */}
                  {(config.type === AgentType.Comms ||
                    config.type === AgentType.Router) && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Active Channels
                      </Label>
                      <div className="flex flex-wrap gap-3">
                        {ALL_CHANNELS.map((channel) => (
                          <div key={channel} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`${config.type}-${channel}`}
                              checked={(config.channels ?? []).includes(channel)}
                              onCheckedChange={(checked) =>
                                toggleChannel(config.type, channel, Boolean(checked))
                              }
                            />
                            <Label
                              htmlFor={`${config.type}-${channel}`}
                              className="cursor-pointer text-sm"
                            >
                              {CHANNEL_LABELS[channel]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
