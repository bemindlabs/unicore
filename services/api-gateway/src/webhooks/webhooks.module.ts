import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LicenseModule } from '../license/license.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LineWebhookController } from './line-webhook.controller';

@Module({
  imports: [ConfigModule, LicenseModule],
  controllers: [TelegramWebhookController, LineWebhookController],
})
export class WebhooksModule {}
