import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  Logger,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from './channels.service';
import { SendMessageDto } from './dto/send-message.dto';
import { InboundMessageDto } from './dto/inbound-message.dto';
import { Public } from '../auth/decorators/public.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

/**
 * ChannelsController — unified messaging endpoint for the API gateway.
 *
 * Routes:
 *   POST /api/v1/channels/send    — Send outbound message to any configured channel (JWT protected)
 *   GET  /api/v1/channels/status  — List configured channels and their status (JWT protected)
 *   POST /api/v1/channels/inbound — Receive forwarded webhook messages and forward to OpenClaw (internal)
 */
@Controller('api/v1/channels')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class ChannelsController {
  private readonly logger = new Logger(ChannelsController.name);

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly config: ConfigService,
  ) {}

  // ─── POST /api/v1/channels/send ────────────────────────────────────────────

  /**
   * Send a message to any configured channel.
   * Protected by JWT — requires a valid access token.
   *
   * Body: { channelType, conversationId, text, recipientId? }
   */
  @Post('send')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async send(@Body() dto: SendMessageDto) {
    this.logger.log(
      `Outbound send request: channel=${dto.channelType}, conversationId=${dto.conversationId}`,
    );

    const result = await this.channelsService.send(
      dto.channelType,
      dto.conversationId,
      dto.text,
      dto.recipientId,
    );

    return result;
  }

  // ─── GET /api/v1/channels/status ───────────────────────────────────────────

  /**
   * Returns the list of all known channels and whether they are configured
   * (i.e. have credentials stored in Settings → Channels).
   * Protected by JWT.
   */
  @Get('status')
  async status() {
    const channels = await this.channelsService.getStatus();
    return { channels };
  }

  // ─── POST /api/v1/channels/inbound ─────────────────────────────────────────

  /**
   * Internal endpoint — receives forwarded webhook messages from webhook controllers
   * (TelegramWebhookController, LineWebhookController, etc.) and forwards them to
   * the OpenClaw multi-agent gateway via HTTP.
   *
   * This endpoint is public (no JWT) because it is called internally from other
   * NestJS controllers within the same gateway process.
   *
   * Body: { channel, senderId, senderName?, text, rawPayload? }
   */
  @Public()
  @Post('inbound')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
  async inbound(@Body() dto: InboundMessageDto) {
    this.logger.log(
      `Inbound message received: channel=${dto.channel}, senderId=${dto.senderId}, text="${dto.text}"`,
    );

    const openclawHost =
      this.config.get<string>('OPENCLAW_SERVICE_HOST') ?? 'unicore-openclaw-gateway';
    const openclawPort =
      this.config.get<string>('OPENCLAW_SERVICE_PORT') ?? '18790';
    const openclawUrl = `http://${openclawHost}:${openclawPort}/api/v1/channels/inbound`;

    // Forward to OpenClaw as a WebSocket-compatible JSON payload (fire-and-forget)
    const payload = {
      channel: dto.channel,
      senderId: dto.senderId,
      senderName: dto.senderName ?? dto.senderId,
      text: dto.text,
      timestamp: new Date().toISOString(),
      rawPayload: dto.rawPayload ?? {},
    };

    fetch(openclawUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err: unknown) => {
      this.logger.error(
        `Failed to forward inbound message to OpenClaw (${openclawUrl}): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return { ok: true };
  }
}
