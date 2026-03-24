'use client';

import { useCallback, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { ChannelConfig, type ChannelField } from './ChannelConfig';

const fields: ChannelField[] = [
  {
    key: 'channelId',
    label: 'Channel ID',
    placeholder: '1234567890',
  },
  {
    key: 'channelSecret',
    label: 'Channel Secret',
    placeholder: 'Your channel secret',
    secret: true,
  },
  {
    key: 'channelAccessToken',
    label: 'Channel Access Token',
    placeholder: 'Your channel access token',
    secret: true,
  },
];

interface LineBotInfo {
  displayName: string;
  pictureUrl?: string;
}

export function LineConfig() {
  const [botInfo, setBotInfo] = useState<LineBotInfo | null>(null);

  const testConnection = useCallback(async (values: Record<string, string>) => {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${values.channelAccessToken}` },
    });
    const data = await response.json();

    if (response.ok) {
      setBotInfo({ displayName: data.displayName, pictureUrl: data.pictureUrl });
      return {
        success: true,
        message: `Connected to ${data.displayName}`,
      };
    }

    return {
      success: false,
      message: data.message ?? 'Invalid Channel Access Token',
    };
  }, []);

  return (
    <ChannelConfig
      channelId="line"
      title="LINE Messaging"
      description={
        <>
          Connect a LINE Official Account for messaging, notifications, and workflow actions.
          Get your credentials from the{' '}
          <a
            href="https://developers.line.biz/console/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            LINE Developers Console
          </a>
          .
        </>
      }
      icon={MessageSquare}
      fields={fields}
      testConnection={testConnection}
      webhookPath="/webhooks/line"
      webhookHint="Set this URL as the Webhook URL in the LINE Developers Console."
      extraContent={
        botInfo ? (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {botInfo.pictureUrl && (
              <img
                src={botInfo.pictureUrl}
                alt={botInfo.displayName}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium">{botInfo.displayName}</p>
              <p className="text-xs text-muted-foreground">LINE Official Account</p>
            </div>
          </div>
        ) : null
      }
    />
  );
}
