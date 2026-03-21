import {
  Controller, Get, Put, Post, Param, Body, Headers, Query,
  UseGuards, UseInterceptors, UploadedFile,
  BadRequestException, NotFoundException,
  Res, StreamableFile, UsePipes, ValidationPipe, Logger,
  Optional, Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { encrypt, decrypt, maskKey } from './crypto.util';
import { BrandingConfigDto } from './dto/branding-config.dto';
import { WizardStatusDto } from './dto/wizard-status.dto';
import { sanitizeCss } from './utils/css-sanitizer';

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/svg+xml': ['.svg'],
  'image/png': ['.png'],
  'image/x-icon': ['.ico'],
  'image/vnd.microsoft.icon': ['.ico'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const BRANDING_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'branding');

const brandingStorage = diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });
    cb(null, BRANDING_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const type = (req.query as any).type ?? 'logo';
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${type}-${Date.now()}${ext}`);
  },
});

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

/**
 * Minimal interface consumed from TenantContextProvider (enterprise package).
 * Using a local interface + string token avoids a hard compile-time dependency
 * on @unicore-enterprise/multi-tenancy in community/pro editions.
 */
interface ITenantContextProvider {
  get(): { tenantId: string } | null;
}

/** DI token published by TenancyModule when enterprise multi-tenancy is active. */
export const TENANT_CONTEXT_PROVIDER = 'TENANT_CONTEXT_PROVIDER';

@Controller('api/v1/settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(TENANT_CONTEXT_PROVIDER)
    private readonly tenantCtx: ITenantContextProvider | null,
  ) {}

  /**
   * Returns the Settings table key for branding.
   * In enterprise multi-tenant mode the key is `branding:{tenantId}`.
   * In community/pro (no tenant context) it falls back to the global `branding` key.
   */
  private getBrandingKey(): string {
    const tenant = this.tenantCtx?.get();
    return tenant?.tenantId ? `branding:${tenant.tenantId}` : 'branding';
  }

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
  async setWizardStatus(@Body() body: WizardStatusDto) {
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

  /**
   * GET branding config — tenant-scoped in enterprise, global otherwise.
   *
   * Resolution order (enterprise):
   *   1. branding:{tenantId}  — tenant-specific override
   *   2. branding             — global fallback
   *
   * Resolution order (community / pro):
   *   1. branding             — global config only
   */
  @Get('branding')
  @ProFeatureRequired('whiteLabelBranding')
  @UseGuards(LicenseGuard)
  async getBranding() {
    const tenantKey = this.getBrandingKey();
    if (tenantKey !== 'branding') {
      const tenantSettings = await this.prisma.settings.findUnique({ where: { id: tenantKey } });
      if (tenantSettings) return tenantSettings.data;
    }
    const settings = await this.prisma.settings.findUnique({ where: { id: 'branding' } });
    return settings?.data ?? {};
  }

  /**
   * PUT branding config — saves to `branding:{tenantId}` in enterprise,
   * or to the global `branding` key in community/pro.
   */
  @Put('branding')
  @ProFeatureRequired('whiteLabelBranding')
  @UseGuards(LicenseGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
  async putBranding(@Body() dto: BrandingConfigDto) {
    if (typeof dto.customCss === 'string') {
      const { sanitized, blocked } = sanitizeCss(dto.customCss);
      if (blocked.length > 0) {
        this.logger.warn(`customCss: blocked dangerous patterns: ${blocked.join(', ')}`);
      }
      dto.customCss = sanitized;
    }
    const key = this.getBrandingKey();
    const settings = await this.prisma.settings.upsert({
      where: { id: key },
      create: { id: key, data: dto as any },
      update: { data: dto as any },
    });
    return settings.data;
  }

  @Post('branding/upload')
  @Roles('OWNER')
  @ProFeatureRequired('whiteLabelBranding')
  @UseGuards(LicenseGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: brandingStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES[file.mimetype]) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
      }
    },
  }))
  async uploadBrandingFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const validTypes = ['logo', 'logoIcon', 'favicon'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException('type must be logo, logoIcon, or favicon');
    }
    // Validate MIME type matches extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ALLOWED_MIME_TYPES[file.mimetype];
    if (!allowedExts || !allowedExts.includes(ext)) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('File MIME type does not match extension');
    }
    return { url: `/api/v1/settings/branding/uploads/${file.filename}` };
  }

  @Public()
  @Get('branding/uploads/:filename')
  serveBrandingFile(@Param('filename') filename: string, @Res() res: Response) {
    // Prevent path traversal
    if (filename.includes('/') || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = path.join(BRANDING_UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  // ── Pro-only: Custom domains ──

  @Get('domains')
  @ProFeatureRequired('allChannels')
  @UseGuards(LicenseGuard)
  async getDomains() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'domains' } });
    return settings?.data ?? {};
  }

  @Put('domains')
  @ProFeatureRequired('allChannels')
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
  @ProFeatureRequired('allChannels')
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
  @ProFeatureRequired('allChannels')
  @UseGuards(LicenseGuard)
  async putTelegram(@Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'telegram' },
      create: { id: 'telegram', data: body },
      update: { data: body },
    });
    return settings.data;
  }

  /** Public: demo mode status (no auth required) */
  @Public()
  @Get('demo-status')
  getDemoStatus() {
    return { demoMode: process.env.DEMO_MODE === 'true' };
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
  @ProFeatureRequired('allAgents')
  @UseGuards(LicenseGuard)
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
