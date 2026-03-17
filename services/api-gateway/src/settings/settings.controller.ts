import { Controller, Get, Put, Param, Body, Headers, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { Public } from '../auth/decorators/public.decorator';
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

  // ── AI Configuration (encrypted API keys) ──

  @Get('ai-config')
  async getAiConfig() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const data = (settings?.data ?? {}) as Record<string, any>;
    // Return masked keys, never plaintext
    return {
      openaiKey: data.openaiKey ? safeDecryptMask(data.openaiKey) : '',
      anthropicKey: data.anthropicKey ? safeDecryptMask(data.anthropicKey) : '',
      defaultProvider: data.defaultProvider ?? 'openai',
      defaultModel: data.defaultModel ?? '',
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
      hasOpenaiKey: !!data.openaiKey,
      hasAnthropicKey: !!data.anthropicKey,
    };
  }

  @Put('ai-config')
  async putAiConfig(@Body() body: { openaiKey?: string; anthropicKey?: string; defaultProvider?: string; defaultModel?: string; openaiAuthType?: string; openaiBaseUrl?: string }) {
    // Read existing config
    const existing = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const current = (existing?.data ?? {}) as Record<string, any>;

    const data: Record<string, any> = {
      defaultProvider: body.defaultProvider ?? current.defaultProvider ?? 'openai',
      defaultModel: body.defaultModel ?? current.defaultModel ?? '',
      openaiAuthType: body.openaiAuthType ?? current.openaiAuthType ?? 'api-key',
      openaiBaseUrl: body.openaiBaseUrl ?? current.openaiBaseUrl ?? '',
    };

    // Only update keys if new values provided (not masked placeholders)
    if (body.openaiKey && !body.openaiKey.includes('••')) {
      data.openaiKey = encrypt(body.openaiKey);
    } else if (current.openaiKey) {
      data.openaiKey = current.openaiKey;
    }

    if (body.anthropicKey && !body.anthropicKey.includes('••')) {
      data.anthropicKey = encrypt(body.anthropicKey);
    } else if (current.anthropicKey) {
      data.anthropicKey = current.anthropicKey;
    }

    await this.prisma.settings.upsert({
      where: { id: 'ai-config' },
      create: { id: 'ai-config', data },
      update: { data },
    });

    // Return masked version
    return {
      openaiKey: data.openaiKey ? safeDecryptMask(data.openaiKey) : '',
      anthropicKey: data.anthropicKey ? safeDecryptMask(data.anthropicKey) : '',
      defaultProvider: data.defaultProvider,
      defaultModel: data.defaultModel,
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
      hasOpenaiKey: !!data.openaiKey,
      hasAnthropicKey: !!data.anthropicKey,
    };
  }

  // Internal endpoint for services to fetch decrypted keys (not exposed externally)
  @Public()
  @Get('ai-config/keys')
  async getAiConfigKeys(@Headers('x-internal-service') internalService: string) {
    if (!internalService) {
      return { openaiKey: '', anthropicKey: '', defaultProvider: 'openai', defaultModel: '' };
    }
    const settings = await this.prisma.settings.findUnique({ where: { id: 'ai-config' } });
    const data = (settings?.data ?? {}) as Record<string, any>;
    return {
      openaiKey: data.openaiKey ? safeDecrypt(data.openaiKey) : '',
      anthropicKey: data.anthropicKey ? safeDecrypt(data.anthropicKey) : '',
      defaultProvider: data.defaultProvider ?? 'openai',
      defaultModel: data.defaultModel ?? '',
      openaiAuthType: data.openaiAuthType ?? 'api-key',
      openaiBaseUrl: data.openaiBaseUrl ?? '',
    };
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
