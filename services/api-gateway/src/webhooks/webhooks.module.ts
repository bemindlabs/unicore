import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LineWebhookController } from './line-webhook.controller';

@Module({
  imports: [LicenseModule],
  controllers: [TelegramWebhookController, LineWebhookController],
})
export class WebhooksModule {}
