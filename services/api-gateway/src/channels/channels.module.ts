import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LicenseModule } from '../license/license.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

/**
 * ChannelsModule — unified messaging for the API gateway.
 *
 * Provides:
 *   POST /api/v1/channels/send    — Outbound send (JWT protected)
 *   GET  /api/v1/channels/status  — Channel status (JWT protected)
 *   POST /api/v1/channels/inbound — Internal inbound relay to OpenClaw (public)
 *
 * PrismaService is globally provided by PrismaModule (imported via AppModule),
 * so it is available to ChannelsService without re-importing PrismaModule here.
 */
@Module({
  imports: [ConfigModule, LicenseModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
