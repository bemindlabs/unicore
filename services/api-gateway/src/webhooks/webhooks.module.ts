import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LicenseModule } from '../license/license.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LineWebhookController } from './line-webhook.controller';
import { FacebookWebhookController } from './facebook-webhook.controller';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { TikTokWebhookController } from './tiktok-webhook.controller';
import { SlackWebhookController } from './slack-webhook.controller';
import { DiscordWebhookController } from './discord-webhook.controller';
import { EmailWebhookController } from './email-webhook.controller';
import { WebchatWebhookController } from './webchat-webhook.controller';
import { InboundRouterService } from './inbound-router.service';
import { WebhooksGateway } from './webhooks.gateway';

@Module({
  imports: [ConfigModule, LicenseModule],
  controllers: [
    TelegramWebhookController,
    LineWebhookController,
    FacebookWebhookController,
    InstagramWebhookController,
    WhatsAppWebhookController,
    TikTokWebhookController,
    SlackWebhookController,
    DiscordWebhookController,
    EmailWebhookController,
    WebchatWebhookController,
  ],
  providers: [InboundRouterService, WebhooksGateway],
  exports: [InboundRouterService],
})
export class WebhooksModule {}
