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
import { getTenantId, isValidTenantId, runWithTenant } from '../common/tenancy/tenant-store';
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';

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
   * Resolve the REQUEST's tenant id (GAPS #1). The trusted tenant is seeded into
   * the request-scoped AsyncLocalStorage store by TenantContextInterceptor (after
   * JWT auth resolves `req.user.tenantId`). The tenant-context provider, when the
   * enterprise tenancy module is active, takes precedence. Falls back to the DEMO
   * bootstrap tenant for unauthenticated/bootstrap paths (e.g. wizard-status).
   *
   * Every Settings read/write is scoped by this value so one tenant can NEVER
   * read or overwrite another tenant's secrets (AI keys, channel bot tokens).
   */
  private tenantId(): string {
    const fromCtx = this.tenantCtx?.get()?.tenantId;
    if (isValidTenantId(fromCtx)) return fromCtx;
    return getTenantId();
  }

  /**
   * Read a tenant-scoped settings row by semantic key. Runs under
   * `runWithTenant` so the explicit tenant also pins the RLS `app.tenant_id`,
   * keeping the WHERE clause and the row-level policy in lock-step (important on
   * @Public() paths where the request store may carry the DEMO fallback).
   */
  private async read(tenantId: string, key: string) {
    return runWithTenant(tenantId, () =>
      this.prisma.settings.findUnique({ where: { tenantId_key: { tenantId, key } } }),
    );
  }

  /** Upsert a tenant-scoped settings row by semantic key (RLS-pinned, see read). */
  private async write(tenantId: string, key: string, data: any) {
    return runWithTenant(tenantId, () =>
      this.prisma.settings.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, data },
        update: { data },
      }),
    );
  }

  /** Public: wizard completion status (no auth required) */
  @Public()
  @Get('wizard-status')
  async getWizardStatus() {
    const settings = await this.read(this.tenantId(), 'wizard-status');
    return settings?.data ?? { completed: false };
  }

  /** Public: save wizard completion (called after provisioning) */
  @Public()
  @Put('wizard-status')
  async setWizardStatus(@Body() body: WizardStatusDto) {
    const data = JSON.parse(JSON.stringify(body));
    const settings = await this.write(this.tenantId(), 'wizard-status', data);
    return settings.data;
  }

  // ── Pro-only: White-label branding ──
  // NOTE: Specific named routes MUST be declared before the catch-all :key routes
  // to prevent NestJS from matching the parameterized route first.

  /**
   * GET branding config — scoped to the request's tenant (GAPS #1). Each tenant
   * has its own `branding` row; no cross-tenant fallback.
   */
  @Get('branding')
  @ProFeatureRequired('whiteLabelBranding')
  @UseGuards(LicenseGuard)
  async getBranding() {
    const settings = await this.read(this.tenantId(), 'branding');
    return settings?.data ?? {};
  }

  /**
   * PUT branding config — saves the request tenant's own `branding` row.
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
    const settings = await this.write(this.tenantId(), 'branding', dto as any);
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
    // Whitelist: only safe filename characters
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
    // Resolve-then-check: ensure resolved path stays within upload dir
    const resolvedDir = path.resolve(BRANDING_UPLOAD_DIR);
    const filePath = path.resolve(BRANDING_UPLOAD_DIR, filename);
    if (!filePath.startsWith(resolvedDir + path.sep)) {
      throw new BadRequestException('Invalid filename');
    }
    // Reject symlinks
    try {
      const stat = fs.lstatSync(filePath);
      if (stat.isSymbolicLink()) {
        throw new BadRequestException('Invalid filename');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new NotFoundException('File not found');
    }
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
    const settings = await this.read(this.tenantId(), 'domains');
    return settings?.data ?? {};
  }

  @Put('domains')
  @ProFeatureRequired('allChannels')
  @UseGuards(LicenseGuard)
  async putDomains(@Body() body: any) {
    const settings = await this.write(this.tenantId(), 'domains', body);
    return settings.data;
  }

  // ── Pro-only: LINE channel configuration ──

  @Put('line')
  @ProFeatureRequired('allChannels')
  @UseGuards(LicenseGuard)
  async putLine(@Body() body: any) {
    const settings = await this.write(this.tenantId(), 'line', body);
    return settings.data;
  }

  // ── Pro-only: Telegram channel configuration ──

  @Put('telegram')
  @ProFeatureRequired('allChannels')
  @UseGuards(LicenseGuard)
  async putTelegram(@Body() body: any) {
    const settings = await this.write(this.tenantId(), 'telegram', body);
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
    const settings = await this.read(this.tenantId(), 'ai-config');
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
    const tenantId = this.tenantId();
    // Read existing config
    const existing = await this.read(tenantId, 'ai-config');
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

    await this.write(tenantId, 'ai-config', data);

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
  async getAiConfigKeys(
    @Headers('x-internal-service') internalService: string,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    if (!internalService || !SettingsController.ALLOWED_INTERNAL_SERVICES.includes(internalService)) {
      return { defaultProvider: 'openai', defaultModel: '' };
    }
    // GAPS #1: scope decrypted-key reads to the FORWARDED tenant. The proxy layer
    // injects the trusted x-tenant-id (stripping any client value); a call with no
    // tenant (e.g. an ai-engine startup prefetch) falls back to the DEMO tenant
    // and therefore CANNOT read another tenant's keys.
    const tenantId = isValidTenantId(tenantHeader) ? tenantHeader : DEMO_TENANT_ID;
    const settings = await this.read(tenantId, 'ai-config');
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
    const settings = await this.read(this.tenantId(), key);
    return settings?.data ?? {};
  }

  @Roles('OWNER')
  @Put('erp-modules')
  async putErpModules(@Body() body: any) {
    const settings = await this.write(this.tenantId(), 'erp-modules', body);
    return settings.data;
  }

  @Roles('OWNER')
  @ProFeatureRequired('allAgents')
  @UseGuards(LicenseGuard)
  @Put(':key')
  async put(@Param('key') key: string, @Body() body: any) {
    const settings = await this.write(this.tenantId(), key, body);
    return settings.data;
  }
}
