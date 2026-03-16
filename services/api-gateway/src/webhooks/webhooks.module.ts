import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LineWebhookController } from './line-webhook.controller';

@Module({
  controllers: [TelegramWebhookController, LineWebhookController],
})
export class WebhooksModule {}
