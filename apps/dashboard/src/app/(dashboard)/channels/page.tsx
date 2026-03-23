'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  BarChart2,
  Camera,
  CheckCircle2,
  Crown,
  Globe,
  Hash,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Plug,
  Send,
  Settings2,
  Smartphone,
  Video,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  toast,
} from '@unicore/ui';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { ChannelConfig } from '@/components/settings/ChannelConfig';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  pro: boolean;
  webhookPath?: string;
  fields: Array<{ key: string; label: string; placeholder?: string; secret?: boolean }>;
  color: string;
}

interface ChannelStats {
  connected: boolean;
  messageCount: number;
  weeklyData: number[]; // 7 days
}

// ── Channel definitions ────────────────────────────────────────────────────

const CHANNELS: ChannelDef[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Connect a Telegram bot for AI-powered conversations',
    icon: Send,
    pro: true,
    webhookPath: '/api/v1/channels/telegram/webhook',
    color: 'text-sky-500',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business API for customer messaging',
    icon: MessageCircle,
    pro: true,
    webhookPath: '/api/v1/channels/whatsapp/webhook',
    color: 'text-green-500',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '123456789' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'EAABcde...', secret: true },
      { key: 'verifyToken', label: 'Verify Token', placeholder: 'my-verify-token', secret: true },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Add a bot to Discord servers for automated responses',
    icon: Hash,
    pro: true,
    webhookPath: '/api/v1/channels/discord/webhook',
    color: 'text-indigo-500',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'MTI3...', secret: true },
      { key: 'applicationId', label: 'Application ID', placeholder: '123456789012345678' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Create a Slack app to respond in channels and DMs',
    icon: MessageSquare,
    pro: true,
    webhookPath: '/api/v1/channels/slack/webhook',
    color: 'text-yellow-500',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...', secret: true },
      { key: 'signingSecret', label: 'Signing Secret', placeholder: 'abc123...', secret: true },
    ],
  },
  {
    id: 'line',
    name: 'LINE',
    description: 'Integrate with LINE messaging platform',
    icon: MessageCircle,
    pro: true,
    webhookPath: '/api/v1/channels/line/webhook',
    color: 'text-emerald-500',
    fields: [
      { key: 'channelId', label: 'Channel ID', placeholder: '1234567890' },
      { key: 'channelSecret', label: 'Channel Secret', placeholder: 'abc123...', secret: true },
      { key: 'channelAccessToken', label: 'Channel Access Token', placeholder: 'eyJhbGc...', secret: true },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook Messenger',
    description: 'Automate responses on your Facebook page',
    icon: Globe,
    pro: true,
    webhookPath: '/api/v1/channels/facebook/webhook',
    color: 'text-blue-600',
    fields: [
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAABcde...', secret: true },
      { key: 'verifyToken', label: 'Verify Token', placeholder: 'my-verify-token', secret: true },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Handle Instagram DMs and comments with AI',
    icon: Camera,
    pro: true,
    webhookPath: '/api/v1/channels/instagram/webhook',
    color: 'text-pink-500',
    fields: [
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAABcde...', secret: true },
      { key: 'igPageId', label: 'Instagram Page ID', placeholder: '123456789' },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Engage with TikTok comments and messages automatically',
    icon: Video,
    pro: true,
    color: 'text-rose-500',
    fields: [
      { key: 'clientKey', label: 'Client Key', placeholder: 'aw6abc...' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'abc123...', secret: true },
    ],
  },
  {
    id: 'sms',
    name: 'SMS (Twilio)',
    description: 'Send and receive SMS messages via Twilio',
    icon: Smartphone,
    pro: true,
    webhookPath: '/api/v1/channels/sms/webhook',
    color: 'text-red-500',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxx...', secret: true },
      { key: 'authToken', label: 'Auth Token', placeholder: 'abc123...', secret: true },
      { key: 'fromNumber', label: 'From Number', placeholder: '+1234567890' },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Connect email inboxes for automated AI replies',
    icon: Mail,
    pro: false,
    webhookPath: '/api/v1/channels/email/webhook',
    color: 'text-blue-500',
    fields: [
      { key: 'smtpHost', label: 'SMTP Host', placeholder: 'smtp.example.com' },
      { key: 'smtpPort', label: 'SMTP Port', placeholder: '587' },
      { key: 'smtpUser', label: 'SMTP User', placeholder: 'user@example.com' },
      { key: 'smtpPass', label: 'SMTP Password', placeholder: '••••••', secret: true },
    ],
  },
  {
    id: 'web-widget',
    name: 'Webchat',
    description: 'Embed a live chat widget on any website',
    icon: MessageCircle,
    pro: false,
    color: 'text-primary',
    fields: [
      { key: 'widgetTitle', label: 'Widget Title', placeholder: 'Chat with us' },
      { key: 'primaryColor', label: 'Primary Color', placeholder: '#6366f1' },
    ],
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Receive and send events via custom HTTP webhooks',
    icon: Webhook,
    pro: false,
    webhookPath: '/api/v1/channels/webhook/incoming',
    color: 'text-violet-500',
    fields: [
      { key: 'secret', label: 'Webhook Secret', placeholder: 'my-secret-key', secret: true },
    ],
  },
];

// ── Sparkline Bar Chart ────────────────────────────────────────────────────

function SparkBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm opacity-70 ${color}`}
          style={{ height: `${Math.max(4, (v / max) * 32)}px`, backgroundColor: 'currentColor' }}
        />
      ))}
    </div>
  );
}

// ── Seed deterministic fake stats ─────────────────────────────────────────

function seedStats(id: string, connected: boolean): ChannelStats {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const weeklyData = Array.from({ length: 7 }, (_, i) =>
    connected ? Math.floor(((hash * (i + 1) * 31) % 200) + 10) : 0,
  );
  return {
    connected,
    messageCount: connected ? weeklyData.reduce((a, b) => a + b, 0) : 0,
    weeklyData,
  };
}

// ── Channel Card ──────────────────────────────────────────────────────────

interface ChannelCardProps {
  channel: ChannelDef;
  stats: ChannelStats;
  locked: boolean;
  onConfigure: () => void;
  onUpgrade: () => void;
}

function ChannelCard({ channel, stats, locked, onConfigure, onUpgrade }: ChannelCardProps) {
  const Icon = channel.icon;

  return (
    <Card
      className={`relative transition-all ${locked ? 'border-dashed opacity-60' : 'cursor-pointer hover:shadow-md hover:border-primary/30'}`}
      onClick={locked ? undefined : onConfigure}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ${channel.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5">
            {channel.pro && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-300/40"
              >
                <Crown className="h-2.5 w-2.5" />
                Pro
              </Badge>
            )}
            {!locked && (
              <Badge
                variant="secondary"
                className={`gap-1 text-xs ${
                  stats.connected
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300/40'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {stats.connected ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                  <XCircle className="h-2.5 w-2.5" />
                )}
                {stats.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-base mt-2">{channel.name}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <CardDescription className="text-xs line-clamp-2">{channel.description}</CardDescription>

        {!locked && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                {stats.messageCount.toLocaleString()} msgs / 7d
              </span>
              <Settings2 className="h-3 w-3 opacity-40" />
            </div>
            <SparkBar data={stats.weeklyData} color={channel.color} />
          </>
        )}

        {locked ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-amber-400/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
          >
            <Lock className="h-3.5 w-3.5" />
            Available in Pro
          </Button>
        ) : stats.connected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
          >
            <Zap className="h-3.5 w-3.5" />
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Config Dialog ─────────────────────────────────────────────────────────

interface ConfigDialogProps {
  channel: ChannelDef | null;
  onClose: () => void;
  onConnected: (id: string) => void;
}

function ConfigDialog({ channel, onClose, onConnected }: ConfigDialogProps) {
  if (!channel) return null;
  const Icon = channel.icon;

  const testConnection = channel.fields.length > 0
    ? async (values: Record<string, string>) => {
        try {
          const res = await api.post<{ success: boolean; message: string }>(
            `/api/v1/channels/${channel.id}/test`,
            values,
          );
          if (res.success) onConnected(channel.id);
          return res;
        } catch (err: any) {
          return { success: false, message: err?.message ?? 'Connection failed' };
        }
      }
    : undefined;

  return (
    <Dialog open={!!channel} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ${channel.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <DialogTitle>{channel.name}</DialogTitle>
          </div>
          <DialogDescription>{channel.description}</DialogDescription>
        </DialogHeader>

        <ChannelConfig
          channelId={channel.id}
          title={channel.name}
          description={channel.description}
          icon={channel.icon}
          fields={channel.fields}
          webhookPath={channel.webhookPath}
          testConnection={testConnection}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { isPro } = useLicense();
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selected, setSelected] = useState<ChannelDef | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(
    () => new Set(['web-widget', 'webhook']), // demo defaults
  );

  // Derive stats per channel
  const statsMap = useMemo<Record<string, ChannelStats>>(
    () =>
      Object.fromEntries(
        CHANNELS.map((ch) => [ch.id, seedStats(ch.id, connectedIds.has(ch.id))]),
      ),
    [connectedIds],
  );

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const res = await api.post<{ url: string }>('/api/v1/license/upgrade', {
        plan: 'PRO_ANNUAL',
        email: user?.email ?? '',
      });
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      toast({ title: 'Upgrade failed', description: err?.message ?? 'Please try again.' });
      setIsUpgrading(false);
    }
  }, [user?.email]);

  const handleConnected = useCallback((id: string) => {
    setConnectedIds((prev) => new Set([...prev, id]));
    toast({ title: 'Channel connected', description: 'Your channel is now active.' });
  }, []);

  const communityChannels = CHANNELS.filter((c) => !c.pro);
  const proChannels = CHANNELS.filter((c) => c.pro);

  const totalMessages = useMemo(
    () =>
      Object.values(statsMap)
        .filter((s) => s.connected)
        .reduce((sum, s) => sum + s.messageCount, 0),
    [statsMap],
  );

  const connectedCount = connectedIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Channels</h1>
            <p className="text-muted-foreground text-sm">
              Connect messaging platforms to handle conversations with AI agents
            </p>
          </div>
        </div>
        {!isPro && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-400/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            onClick={handleUpgrade}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crown className="h-3.5 w-3.5" />
            )}
            Unlock all channels
          </Button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Connected</p>
          <p className="text-2xl font-bold mt-1">{connectedCount}</p>
          <p className="text-xs text-muted-foreground">of {CHANNELS.length} channels</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Messages (7d)</p>
          <p className="text-2xl font-bold mt-1">{totalMessages.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">across all channels</p>
        </Card>
        <Card className="p-4 hidden sm:block">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pro Channels</p>
          <p className="text-2xl font-bold mt-1">{proChannels.length}</p>
          <p className="text-xs text-muted-foreground">{isPro ? 'all unlocked' : 'require Pro'}</p>
        </Card>
      </div>

      {/* Community channels */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Community
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {communityChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              stats={statsMap[channel.id]!}
              locked={false}
              onConfigure={() => setSelected(channel)}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      </div>

      {/* Pro channels */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Pro Channels
          </h2>
          <Badge
            variant="secondary"
            className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-300/40"
          >
            <Crown className="h-2.5 w-2.5" />
            Pro
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {proChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              stats={statsMap[channel.id]!}
              locked={!isPro}
              onConfigure={() => setSelected(channel)}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      </div>

      {/* Config dialog */}
      <ConfigDialog
        channel={selected}
        onClose={() => setSelected(null)}
        onConnected={(id) => {
          handleConnected(id);
          setSelected(null);
        }}
      />
    </div>
  );
}
