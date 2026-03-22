import {
  Controller, Get, Post, Body, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { CommsService, SendEmailDto, ScheduleSocialPostDto } from './comms.service';

@Controller('api/v1/comms')
export class CommsController {
  private readonly logger = new Logger(CommsController.name);

  constructor(private readonly commsService: CommsService) {}

  /** GET /api/v1/comms/health */
  @Get('health')
  health() {
    return { status: 'ok', service: 'comms', timestamp: new Date().toISOString() };
  }

  /** POST /api/v1/comms/email/send */
  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  sendEmail(@Body() dto: SendEmailDto) {
    this.logger.log(`POST /comms/email/send → to=${dto.to}`);
    return this.commsService.sendEmail(dto);
  }

  /** GET /api/v1/comms/email/inbox */
  @Get('email/inbox')
  getInbox() {
    this.logger.log('GET /comms/email/inbox');
    return this.commsService.getInbox();
  }

  /** POST /api/v1/comms/social/schedule */
  @Post('social/schedule')
  @HttpCode(HttpStatus.OK)
  scheduleSocialPost(@Body() dto: ScheduleSocialPostDto) {
    this.logger.log(`POST /comms/social/schedule → channel=${dto.channel}`);
    return this.commsService.scheduleSocialPost(dto);
  }

  /** GET /api/v1/comms/social/feed */
  @Get('social/feed')
  getSocialFeed() {
    this.logger.log('GET /comms/social/feed');
    return this.commsService.getSocialFeed();
  }
}
