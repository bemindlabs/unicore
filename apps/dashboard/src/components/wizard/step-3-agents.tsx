'use client';

import { AutonomyLevel } from '@unicore/shared-types';
import type { AgentChannel } from '@unicore/shared-types';
import {
  Badge,
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
  Switch,
  cn,
} from '@unicore/ui';

import { useWizardState } from '@/hooks/use-wizard-state';
import { AGENT_DEFINITIONS } from '@/types/wizard';

const AUTONOMY_OPTIONS = [
  { value: AutonomyLevel.Suggest, label: 'Suggest', description: 'Agent suggests, you decide' },
  { value: AutonomyLevel.Approval, label: 'Approval', description: 'Agent acts after your approval' },
  { value: AutonomyLevel.FullAuto, label: 'Full Auto', description: 'Agent acts autonomously' },
];

const CHANNEL_OPTIONS: { value: AgentChannel; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'line', label: 'LINE' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
];

export function StepAgents() {
  const { state, dispatch } = useWizardState();

  function toggleChannel(agentIndex: number, channel: AgentChannel) {
    const agent = state.agents[agentIndex];
    const channels = agent.channels ?? [];
    const updated = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel];
    dispatch({ type: 'UPDATE_AGENT', agentIndex, data: { channels: updated } });
  }

  const enabledCount = state.agents.filter((a) => a.enabled).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Agents</h2>
        <p className="text-muted-foreground mt-1">
          Enable AI agents and configure their autonomy levels and communication channels.
        </p>
        <Badge variant="secondary" className="mt-2">
          {enabledCount} agent{enabledCount !== 1 ? 's' : ''} enabled
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {AGENT_DEFINITIONS.map((def, index) => {
          const agent = state.agents[index];
          return (
            <Card
              key={def.type}
              className={cn(
                'transition-all',
                agent.enabled ? 'border-primary/30 shadow-sm' : 'opacity-60',
              )}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{def.name}</CardTitle>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={() => dispatch({ type: 'TOGGLE_AGENT', agentIndex: index })}
                  />
                </div>
                <CardDescription className="text-xs">{def.description}</CardDescription>
              </CardHeader>

              {agent.enabled && (
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Autonomy Level</Label>
                    <Select
                      value={agent.autonomy}
                      onValueChange={(v) =>
                        dispatch({
                          type: 'UPDATE_AGENT',
                          agentIndex: index,
                          data: { autonomy: v as AutonomyLevel },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTONOMY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label} — {opt.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Channels</Label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNEL_OPTIONS.map((ch) => (
                        <label
                          key={ch.value}
                          className="flex items-center gap-1.5 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={(agent.channels ?? []).includes(ch.value)}
                            onCheckedChange={() => toggleChannel(index, ch.value)}
                            className="h-3.5 w-3.5"
                          />
                          {ch.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
