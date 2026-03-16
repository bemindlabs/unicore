import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: wizard completion status (no auth required) */
  @Public()
  @Get('wizard-status')
  async getWizardStatus() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'wizard-status' } });
    return settings?.data ?? { completed: false };
  }

  /** Public: save wizard completion (called after provisioning) */
  @Public()
  @Put('wizard-status')
  async setWizardStatus(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'wizard-status' },
      create: { id: 'wizard-status', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  // ── Pro-only: White-label branding ──
  // NOTE: Specific named routes MUST be declared before the catch-all :key routes
  // to prevent NestJS from matching the parameterized route first.

  @Put('branding')
  @ProFeatureRequired('white_label')
  @UseGuards(LicenseGuard)
  async putBranding(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'branding' },
      create: { id: 'branding', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  // ── Pro-only: Custom domains ──

  @Get('domains')
  @ProFeatureRequired('custom_integrations')
  @UseGuards(LicenseGuard)
  async getDomains() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'domains' } });
    return settings?.data ?? {};
  }

  @Put('domains')
  @ProFeatureRequired('custom_integrations')
  @UseGuards(LicenseGuard)
  async putDomains(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'domains' },
      create: { id: 'domains', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  // ── Pro-only: LINE channel configuration ──

  @Put('line')
  @ProFeatureRequired('multi_channel')
  @UseGuards(LicenseGuard)
  async putLine(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'line' },
      create: { id: 'line', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  // ── Pro-only: Telegram channel configuration ──

  @Put('telegram')
  @ProFeatureRequired('multi_channel')
  @UseGuards(LicenseGuard)
  async putTelegram(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'telegram' },
      create: { id: 'telegram', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  // ── Team member count (used by license settings page) ──

  @Get('team/count')
  async getTeamCount() {
    const count = await this.prisma.user.count();
    return { count };
  }

  // ── Generic catch-all routes — MUST be last to avoid shadowing named routes ──

  @Get(':key')
  async get(@Param('key') key: string) {
    const settings = await this.prisma.settings.findUnique({ where: { id: key } });
    return settings?.data ?? {};
  }

  @Put(':key')
  async put(@Param('key') key: string, @Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: key },
      create: { id: key, data: body },
      update: { data: body },
    });
    return settings.data;
  }
}
