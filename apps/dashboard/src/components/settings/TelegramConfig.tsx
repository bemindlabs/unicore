'use client';

import { useCallback, useState } from 'react';
import { Bot } from 'lucide-react';
import { ChannelConfig, type ChannelField } from './ChannelConfig';

const fields: ChannelField[] = [
  {
    key: 'botToken',
    label: 'Bot Token',
    placeholder: '123456789:ABCdefGhIjKlMnOpQrStUvWxYz',
    secret: true,
  },
];

export function TelegramConfig() {
  const [botUsername, setBotUsername] = useState<string | null>(null);

  const testConnection = useCallback(async (values: Record<string, string>) => {
    const response = await fetch(
      `https://api.telegram.org/bot${values.botToken}/getMe`,
    );
    const data = await response.json();

    if (data.ok) {
      setBotUsername(`@${data.result.username}`);
      return {
        success: true,
        message: `Connected to @${data.result.username}`,
      };
    }

    return {
      success: false,
      message: data.description ?? 'Invalid bot token',
    };
  }, []);

  return (
    <ChannelConfig
      channelId="telegram"
      title="Telegram Bot"
      description={
        <>
          Connect a Telegram Bot for messaging, notifications, and workflow actions.
          Create a bot via{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            @BotFather
          </a>{' '}
          to get your token.
        </>
      }
      icon={Bot}
      fields={fields}
      testConnection={testConnection}
      webhookPath="/webhooks/telegram"
      extraContent={
        botUsername ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Bot Username</label>
            <p className="text-sm text-muted-foreground">{botUsername}</p>
          </div>
        ) : null
      }
    />
  );
}
