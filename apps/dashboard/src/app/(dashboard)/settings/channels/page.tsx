'use client';

import { Crown, Lock, MessageCircle, Webhook, Mail, Globe } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@bemindlabs/unicore-ui';
import { useLicense } from '@/hooks/use-license';
import { useAuth } from '@/hooks/use-auth';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from '@bemindlabs/unicore-ui';
import { Loader2 } from 'lucide-react';

// ── Channel definitions ────────────────────────────────────────────────────

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  pro: boolean;
  comingSoon?: boolean;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Receive and send events via HTTP webhooks',
    icon: Webhook,
    pro: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Connect email inboxes for automated replies',
    icon: Mail,
    pro: false,
  },
  {
    id: 'web-widget',
    name: 'Web Widget',
    description: 'Embed a chat widget on any website',
    icon: Globe,
    pro: false,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Connect a Telegram bot for AI-powered conversations',
    icon: MessageCircle,
    pro: true,
  },
  {
    id: 'line',
    name: 'LINE',
    description: 'Integrate with LINE messaging platform',
    icon: MessageCircle,
    pro: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business API for customer messaging',
    icon: MessageCircle,
    pro: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Create a Slack app to respond in channels and DMs',
    icon: MessageCircle,
    pro: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Add a bot to Discord servers for automated responses',
    icon: MessageCircle,
    pro: true,
  },
  {
    id: 'facebook',
    name: 'Facebook Messenger',
    description: 'Automate responses on your Facebook page',
    icon: MessageCircle,
    pro: true,
  },
];

// ── Channel Card ──────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  locked,
  onUpgrade,
}: {
  channel: ChannelDef;
  locked: boolean;
  onUpgrade: () => void;
}) {
  const Icon = channel.icon;
  return (
    <Card className={locked ? 'border-dashed opacity-60' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            {channel.pro && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-300/40"
              >
                <Crown className="h-2.5 w-2.5" />
                Pro
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-base">{channel.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-3">{channel.description}</CardDescription>
        {locked ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-amber-400/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            onClick={onUpgrade}
          >
            <Lock className="h-3.5 w-3.5" />
            Available in Pro
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full">
            Configure
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ChannelsSettingsPage() {
  const { isPro } = useLicense();
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

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

  const communityChannels = CHANNELS.filter((c) => !c.pro);
  const proChannels = CHANNELS.filter((c) => c.pro);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Messaging Channels</h1>
            <p className="text-muted-foreground">
              Connect platforms to receive and respond to messages via AI agents
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

      {/* Community channels */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Community
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communityChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              locked={false}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              locked={!isPro}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
