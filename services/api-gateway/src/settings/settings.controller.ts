import { Controller, Get, Put, Param, Body, Headers, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { encrypt, decrypt, maskKey } from './crypto.util';

function safeDecryptMask(encrypted: string): string {
  try {
    return maskKey(decrypt(encrypted));
  } catch {
    return '••••(corrupted)';
  }
}

function safeDecrypt(encrypted: string): string {
  try {
    return decrypt(encrypted);
  } catch {
    return '';
  }
}

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
  @ProFeatureRequired('whiteLabelBranding')
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

  // ── AI Configuration (encrypted API keys) ──

  private static readonly PROVIDER_KEY_FIELDS = [
    'openaiKey', 'anthropicKey', 'moonshotKey', 'openrouterKey',
    'deepseekKey', 'groqKey', 'geminiKey', 'mistralKey',
    'xaiKey', 'togetherKey', 'fireworksKey', 'cohereKey',
  ];

  @Get('ai-config')
  async getAiConfig() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const data = (settings?.data ?? {}) as Record<string, any>;
    const result: Record<string, any> = {
      defaultProvider: data.defaultProvider ?? 'openai',
      defaultModel: data.defaultModel ?? '',
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
    };
    for (const field of SettingsController.PROVIDER_KEY_FIELDS) {
      result[field] = data[field] ? safeDecryptMask(data[field]) : '';
      const hasField = `has${field[0].toUpperCase()}${field.slice(1)}`;
      result[hasField] = !!data[field];
    }
    return result;
  }

  @Roles('OWNER')
  @Put('ai-config')
  async putAiConfig(@Body() body: Record<string, string>) {
    // Read existing config
    const existing = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const current = (existing?.data ?? {}) as Record<string, any>;

    const data: Record<string, any> = {};

    // Copy all non-key string fields from body, falling back to current
    for (const field of Object.keys(body)) {
      if (!field.endsWith('Key')) {
        data[field] = body[field];
      }
    }
    // Ensure defaults
    data.defaultProvider = data.defaultProvider ?? current.defaultProvider ?? 'openai';
    data.defaultModel = data.defaultModel ?? current.defaultModel ?? '';
    data.openaiAuthType = data.openaiAuthType ?? current.openaiAuthType ?? 'api-key';
    data.openaiBaseUrl = data.openaiBaseUrl ?? current.openaiBaseUrl ?? '';

    // Encrypt key fields (or delete if __DELETE__)
    for (const field of SettingsController.PROVIDER_KEY_FIELDS) {
      if (body[field] === '__DELETE__') {
        // Delete the key — don't copy from current
      } else if (body[field] && !body[field].includes('••')) {
        data[field] = encrypt(body[field]);
      } else if (current[field]) {
        data[field] = current[field];
      }
    }

    await this.prisma.settings.upsert({
      where: { id: 'ai-config' },
      create: { id: 'ai-config', data },
      update: { data },
    });

    // Build masked response
    const result: Record<string, any> = {
      defaultProvider: data.defaultProvider,
      defaultModel: data.defaultModel,
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
    };
    for (const field of SettingsController.PROVIDER_KEY_FIELDS) {
      result[field] = data[field] ? safeDecryptMask(data[field]) : '';
      result[`has${field[0].toUpperCase()}${field.slice(1)}`] = !!data[field];
    }
    return result;
  }

  // Internal endpoint for services to fetch decrypted keys (not exposed externally)
  private static readonly ALLOWED_INTERNAL_SERVICES = ['ai-engine', 'rag', 'openclaw-gateway', 'workflow'];

  @Public()
  @Get('ai-config/keys')
  async getAiConfigKeys(@Headers('x-internal-service') internalService: string) {
    if (!internalService || !SettingsController.ALLOWED_INTERNAL_SERVICES.includes(internalService)) {
      return { defaultProvider: 'openai', defaultModel: '' };
    }
    const settings = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const data = (settings?.data ?? {}) as Record<string, any>;
    const result: Record<string, any> = {
      defaultProvider: data.defaultProvider ?? 'openai',
      defaultModel: data.defaultModel ?? '',
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
    };
    for (const field of SettingsController.PROVIDER_KEY_FIELDS) {
      result[field] = data[field] ? safeDecrypt(data[field]) : '';
    }
    return result;
  }

  // ── Generic catch-all routes — MUST be last to avoid shadowing named routes ──

  @Roles('OWNER')
  @Get(':key')
  async get(@Param('key') key: string) {
    const settings = await this.prisma.settings.findUnique({ where: { id: key } });
    return settings?.data ?? {};
  }

  @Roles('OWNER')
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
