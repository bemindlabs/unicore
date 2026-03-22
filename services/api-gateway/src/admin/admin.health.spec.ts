import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { LicenseService } from '../license/license.service';

const mockPrismaService = {
  user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  session: { findMany: jest.fn(), deleteMany: jest.fn() },
  chatHistory: { deleteMany: jest.fn() },
  task: { updateMany: jest.fn() },
  $queryRaw: jest.fn(),
};

const mockAuditService = { log: jest.fn(), query: jest.fn() };
const mockTokenBlacklist = { blacklist: jest.fn() };
const mockLicenseService = {
  hasFeature: jest.fn().mockResolvedValue(true),
  getLicenseStatus: jest.fn().mockResolvedValue({ tier: 'pro' }),
};

describe('AdminController — health endpoint', () => {
  let controller: AdminController;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklist },
        { provide: LicenseService, useValue: mockLicenseService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    originalFetch = global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns services array with uptime and timestamp', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const result = await controller.health();

    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('uptime');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('totalMs');
    expect(Array.isArray(result.services)).toBe(true);
  });

  it('marks PostgreSQL as healthy when $queryRaw succeeds', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const result = await controller.health();

    const pg = result.services.find((s: any) => s.name === 'PostgreSQL');
    expect(pg).toBeDefined();
    expect(pg!.status).toBe('healthy');
    expect(pg!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('marks PostgreSQL as down when $queryRaw throws', async () => {
    mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const result = await controller.health();

    const pg = result.services.find((s: any) => s.name === 'PostgreSQL');
    expect(pg.status).toBe('down');
  });

  it('marks ERP Service as healthy when fetch succeeds with ok=true', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const result = await controller.health();

    const erp = result.services.find((s: any) => s.name === 'ERP Service');
    expect(erp.status).toBe('healthy');
  });

  it('marks ERP Service as degraded when fetch returns ok=false', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

    const result = await controller.health();

    const erp = result.services.find((s: any) => s.name === 'ERP Service');
    expect(erp.status).toBe('degraded');
  });

  it('marks services as down when fetch throws', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const result = await controller.health();

    const erp = result.services.find((s: any) => s.name === 'ERP Service');
    expect(erp.status).toBe('down');
  });

  it('includes all expected services in response', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const result = await controller.health();

    const serviceNames = result.services.map((s: any) => s.name);
    expect(serviceNames).toContain('PostgreSQL');
    expect(serviceNames).toContain('ERP Service');
    expect(serviceNames).toContain('OpenClaw Gateway');
    expect(serviceNames).toContain('RAG Service');
    expect(serviceNames).toContain('AI Engine');
  });
});

describe('AdminController — auditLogs endpoint', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklist },
        { provide: LicenseService, useValue: mockLicenseService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('delegates to auditService.query with parsed params', async () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 50, totalPages: 0 };
    mockAuditService.query.mockResolvedValue(mockResult);

    const result = await controller.auditLogs({ page: '2', limit: '25', action: 'delete', resource: 'users' });

    expect(mockAuditService.query).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
      action: 'delete',
      resource: 'users',
      search: undefined,
    });
    expect(result).toEqual(mockResult);
  });

  it('uses defaults when no query params provided', async () => {
    mockAuditService.query.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    await controller.auditLogs({});

    expect(mockAuditService.query).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      action: undefined,
      resource: undefined,
      search: undefined,
    });
  });
});
