import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ServiceUnavailableException, ConflictException } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { TemplatesService } from '../templates/templates.service';
import { ConfigGeneratorService } from '../config-generator/config-generator.service';
import { WizardStatusService } from '../wizard/wizard-status.service';
import type { Template } from '../common/interfaces/template.interface';
import type { UniCoreConfig } from '../config-generator/config-generator.service';
import type { ProvisionRequestDto } from '../dto/provision-request.dto';

const mockTemplate: Template = {
  id: 'saas',
  name: 'SaaS',
  description: 'SaaS business platform',
  erp: {
    contacts: true,
    orders: true,
    inventory: false,
    invoicing: true,
    expenses: true,
    reports: true,
  },
  agents: {
    comms: true,
    finance: true,
    growth: true,
    ops: true,
    research: true,
    erp: false,
    builder: true,
    sentinel: false,
  },
  dashboard: { widgets: ['mrr', 'churn'] },
  channels: ['email', 'web', 'slack'],
  workflows: ['trial_expiry', 'churn_risk'],
};

const mockConfig: UniCoreConfig = {
  business: { name: 'Acme Corp', template: 'saas', locale: 'en', currency: 'USD', timezone: 'UTC' },
  roles: [
    { role: 'owner', enabled: true },
    { role: 'operator', enabled: true },
    { role: 'marketer', enabled: true },
    { role: 'finance', enabled: true },
    { role: 'viewer', enabled: true },
  ],
  agents: [
    { type: 'router', enabled: true, autonomy: 'full_auto' },
    { type: 'comms', enabled: true, autonomy: 'approval' },
  ],
  erp: { modules: mockTemplate.erp, currency: 'USD', timezone: 'UTC' },
  integrations: [],
};

const mockAdminUser = { id: 'user-uuid-1', email: 'admin@acme.com', name: 'Admin', role: 'OWNER' };

const mockTemplatesService = {
  findById: jest.fn().mockReturnValue(mockTemplate),
  findAll: jest.fn().mockReturnValue([mockTemplate]),
};

const mockConfigGeneratorService = {
  generate: jest.fn().mockReturnValue(mockConfig),
};

const mockWizardStatusService = {
  isComplete: jest.fn().mockReturnValue(false),
  markComplete: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ completed: false }),
};

const makeRequest = (overrides: Partial<ProvisionRequestDto> = {}): ProvisionRequestDto =>
  ({
    bootstrapSecret: 'test-secret',
    businessName: 'Acme Corp',
    template: 'saas',
    locale: 'en',
    currency: 'USD',
    timezone: 'UTC',
    adminName: 'Admin',
    adminEmail: 'admin@acme.com',
    adminPassword: 'Password1',
    ...overrides,
  }) as ProvisionRequestDto;

/** Build a minimal mock Response */
const mockResponse = (
  ok: boolean,
  data?: unknown,
  status = ok ? 200 : 500,
): Response =>
  ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(data ?? {}),
    text: jest.fn().mockResolvedValue(String(data ?? '')),
  }) as unknown as Response;

describe('ProvisioningService', () => {
  let service: ProvisioningService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset wizard to not-complete by default
    mockWizardStatusService.isComplete.mockReturnValue(false);

    process.env.BOOTSTRAP_SECRET = 'test-secret';
    process.env.API_GATEWAY_URL = 'http://api-gateway:4000';
    process.env.LICENSE_API_URL = 'http://license-api:4600';
    process.env.LICENSE_ADMIN_SECRET = 'license-admin-secret';
    process.env.OPENCLAW_GATEWAY_URL = 'http://openclaw:18790';

    // Default fetch: all calls succeed
    (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/provision-admin')) {
        return Promise.resolve(mockResponse(true, mockAdminUser));
      }
      if (url.includes('/api/v1/licenses')) {
        return Promise.resolve(mockResponse(true, { key: 'UC-1234-5678-ABCD-EFGH' }));
      }
      if (url.includes('/health/agents/register')) {
        return Promise.resolve(mockResponse(true));
      }
      return Promise.resolve(mockResponse(false, 'Not found', 404));
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisioningService,
        { provide: TemplatesService, useValue: mockTemplatesService },
        { provide: ConfigGeneratorService, useValue: mockConfigGeneratorService },
        { provide: WizardStatusService, useValue: mockWizardStatusService },
      ],
    }).compile();

    service = module.get<ProvisioningService>(ProvisioningService);
  });

  afterEach(() => {
    delete process.env.BOOTSTRAP_SECRET;
    delete process.env.API_GATEWAY_URL;
    delete process.env.LICENSE_API_URL;
    delete process.env.LICENSE_ADMIN_SECRET;
    delete process.env.OPENCLAW_GATEWAY_URL;
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('bootstrap secret validation', () => {
    it('throws UnauthorizedException when BOOTSTRAP_SECRET env var is not set', async () => {
      delete process.env.BOOTSTRAP_SECRET;
      await expect(service.provision(makeRequest())).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when secret does not match', async () => {
      await expect(service.provision(makeRequest({ bootstrapSecret: 'wrong-secret' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException with "Invalid bootstrap secret" message', async () => {
      await expect(service.provision(makeRequest({ bootstrapSecret: 'bad' }))).rejects.toThrow(
        'Invalid bootstrap secret',
      );
    });

    it('proceeds when secret matches', async () => {
      await expect(service.provision(makeRequest())).resolves.toBeDefined();
    });
  });

  describe('wizard lockout', () => {
    it('throws ConflictException when wizard is already complete', async () => {
      mockWizardStatusService.isComplete.mockReturnValue(true);
      await expect(service.provision(makeRequest())).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException with descriptive message when already provisioned', async () => {
      mockWizardStatusService.isComplete.mockReturnValue(true);
      await expect(service.provision(makeRequest())).rejects.toThrow(
        'Platform is already provisioned',
      );
    });

    it('does not check secret when wizard lockout triggers first', async () => {
      mockWizardStatusService.isComplete.mockReturnValue(true);
      // Even with wrong secret, lockout fires first
      await expect(
        service.provision(makeRequest({ bootstrapSecret: 'wrong' })),
      ).rejects.toThrow(ConflictException);
    });

    it('calls markComplete after successful provisioning', async () => {
      await service.provision(makeRequest());
      expect(mockWizardStatusService.markComplete).toHaveBeenCalledTimes(1);
    });

    it('does not call markComplete when provisioning fails at API gateway', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(mockResponse(true));
      });
      await expect(service.provision(makeRequest())).rejects.toThrow(ServiceUnavailableException);
      expect(mockWizardStatusService.markComplete).not.toHaveBeenCalled();
    });

    it('checks wizard status before secret validation', async () => {
      const callOrder: string[] = [];
      mockWizardStatusService.isComplete.mockImplementation(() => {
        callOrder.push('isComplete');
        return false;
      });
      // Override fetch to track order
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(true, { key: 'UC-TEST' }));
        return Promise.resolve(mockResponse(true));
      });
      await service.provision(makeRequest());
      expect(callOrder[0]).toBe('isComplete');
    });
  });

  describe('successful provisioning', () => {
    it('returns success=true', async () => {
      const result = await service.provision(makeRequest());
      expect(result.success).toBe(true);
    });

    it('returns the generated config from ConfigGeneratorService', async () => {
      const result = await service.provision(makeRequest());
      expect(result.config).toEqual(mockConfig);
    });

    it('returns admin user data from API gateway response', async () => {
      const result = await service.provision(makeRequest());
      expect(result.admin).toEqual(mockAdminUser);
    });

    it('returns licenseKey when license API succeeds', async () => {
      const result = await service.provision(makeRequest());
      expect(result.licenseKey).toBe('UC-1234-5678-ABCD-EFGH');
    });

    it('returns correct summary with template and businessName', async () => {
      const result = await service.provision(makeRequest());
      expect(result.summary.template).toBe('saas');
      expect(result.summary.businessName).toBe('Acme Corp');
    });

    it('includes enabled ERP modules in summary', async () => {
      const result = await service.provision(makeRequest());
      expect(result.summary.erpModulesEnabled).toEqual(
        expect.arrayContaining(['contacts', 'orders', 'invoicing', 'expenses', 'reports']),
      );
      expect(result.summary.erpModulesEnabled).not.toContain('inventory');
    });

    it('includes enabled agents in summary', async () => {
      const result = await service.provision(makeRequest());
      expect(result.summary.agentsEnabled).toEqual(
        expect.arrayContaining(['comms', 'finance', 'growth', 'ops', 'research', 'builder']),
      );
      expect(result.summary.agentsEnabled).not.toContain('erp');
    });

    it('includes enabled roles in summary', async () => {
      const result = await service.provision(makeRequest());
      expect(result.summary.rolesEnabled).toEqual(
        expect.arrayContaining(['owner', 'operator', 'marketer', 'finance', 'viewer']),
      );
    });

    it('does not include warnings property when all operations succeed', async () => {
      const result = await service.provision(makeRequest());
      expect(result.warnings).toBeUndefined();
    });

    it('delegates template lookup to TemplatesService.findById', async () => {
      await service.provision(makeRequest());
      expect(mockTemplatesService.findById).toHaveBeenCalledWith('saas');
    });

    it('delegates config generation to ConfigGeneratorService.generate', async () => {
      await service.provision(makeRequest());
      expect(mockConfigGeneratorService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ businessName: 'Acme Corp', template: 'saas' }),
        mockTemplate,
      );
    });

    it('sends bootstrap secret as X-Bootstrap-Secret header to API gateway', async () => {
      await service.provision(makeRequest());
      const fetchMock = (global as Record<string, unknown>).fetch as jest.Mock;
      const adminCall = fetchMock.mock.calls.find(([url]: [string]) =>
        url.includes('/auth/provision-admin'),
      );
      expect(adminCall).toBeDefined();
      expect(adminCall[1].headers['X-Bootstrap-Secret']).toBe('test-secret');
    });

    it('sends admin credentials as JSON body to API gateway', async () => {
      await service.provision(makeRequest());
      const fetchMock = (global as Record<string, unknown>).fetch as jest.Mock;
      const adminCall = fetchMock.mock.calls.find(([url]: [string]) =>
        url.includes('/auth/provision-admin'),
      );
      const body = JSON.parse(adminCall[1].body as string);
      expect(body).toMatchObject({
        email: 'admin@acme.com',
        name: 'Admin',
        password: 'Password1',
        role: 'OWNER',
      });
    });
  });

  describe('API gateway errors', () => {
    it('throws ServiceUnavailableException when API gateway is unreachable (network error)', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) {
          return Promise.reject(new Error('ECONNREFUSED connect ECONNREFUSED 127.0.0.1:4000'));
        }
        return Promise.resolve(mockResponse(true));
      });
      await expect(service.provision(makeRequest())).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when API gateway returns non-ok status', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) {
          return Promise.resolve(mockResponse(false, 'User already exists', 409));
        }
        return Promise.resolve(mockResponse(true));
      });
      await expect(service.provision(makeRequest())).rejects.toThrow(ServiceUnavailableException);
    });

    it('includes error detail in ServiceUnavailableException message', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) {
          return Promise.reject(new Error('Connection timeout'));
        }
        return Promise.resolve(mockResponse(true));
      });
      await expect(service.provision(makeRequest())).rejects.toThrow('Connection timeout');
    });
  });

  describe('license creation (non-fatal)', () => {
    it('adds warning and proceeds when LICENSE_ADMIN_SECRET is not configured', async () => {
      delete process.env.LICENSE_ADMIN_SECRET;
      const result = await service.provision(makeRequest());
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('LICENSE_ADMIN_SECRET')]),
      );
    });

    it('adds warning and proceeds when license API returns non-ok status', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(false, 'Service unavailable', 503));
        return Promise.resolve(mockResponse(true));
      });
      const result = await service.provision(makeRequest());
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('503')]));
    });

    it('adds warning and proceeds when license API throws', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.reject(new Error('ECONNREFUSED'));
        return Promise.resolve(mockResponse(true));
      });
      const result = await service.provision(makeRequest());
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('non-fatal')]));
    });

    it('extracts licenseKey from key property in license response', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(true, { key: 'UC-AAAA-BBBB-CCCC-DDDD' }));
        return Promise.resolve(mockResponse(true));
      });
      const result = await service.provision(makeRequest());
      expect(result.licenseKey).toBe('UC-AAAA-BBBB-CCCC-DDDD');
    });

    it('extracts licenseKey from licenseKey property in license response', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(true, { licenseKey: 'UC-XXXX-YYYY-ZZZZ-1111' }));
        return Promise.resolve(mockResponse(true));
      });
      const result = await service.provision(makeRequest());
      expect(result.licenseKey).toBe('UC-XXXX-YYYY-ZZZZ-1111');
    });
  });

  describe('agent registration (non-fatal)', () => {
    it('adds warning and proceeds when OpenClaw gateway is unreachable', async () => {
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(true, { key: 'UC-TEST' }));
        if (url.includes('/health/agents/register')) return Promise.reject(new Error('ECONNREFUSED'));
        return Promise.resolve(mockResponse(false));
      });
      const result = await service.provision(makeRequest());
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('OpenClaw')]));
    });

    it('adds partial warning when only some agents register successfully', async () => {
      let agentCallCount = 0;
      (global as Record<string, unknown>).fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/provision-admin')) return Promise.resolve(mockResponse(true, mockAdminUser));
        if (url.includes('/api/v1/licenses')) return Promise.resolve(mockResponse(true, { key: 'UC-TEST' }));
        if (url.includes('/health/agents/register')) {
          agentCallCount++;
          return Promise.resolve(mockResponse(agentCallCount <= 3));
        }
        return Promise.resolve(mockResponse(false));
      });
      const result = await service.provision(makeRequest());
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('3/9')]));
    });

    it('attempts to register all 9 default agents', async () => {
      await service.provision(makeRequest());
      const fetchMock = (global as Record<string, unknown>).fetch as jest.Mock;
      const agentCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
        url.includes('/health/agents/register'),
      );
      expect(agentCalls).toHaveLength(9);
    });

    it('does not add agent warnings when all 9 agents register', async () => {
      const result = await service.provision(makeRequest());
      expect(result.warnings).toBeUndefined();
    });
  });

  describe('wizard status management', () => {
    it('calls TemplatesService before ConfigGeneratorService', async () => {
      const callOrder: string[] = [];
      mockTemplatesService.findById.mockImplementation(() => {
        callOrder.push('findById');
        return mockTemplate;
      });
      mockConfigGeneratorService.generate.mockImplementation(() => {
        callOrder.push('generate');
        return mockConfig;
      });

      await service.provision(makeRequest());
      expect(callOrder).toEqual(['findById', 'generate']);
    });

    it('calls isComplete to check lockout on each provision attempt', async () => {
      await service.provision(makeRequest());
      expect(mockWizardStatusService.isComplete).toHaveBeenCalled();
    });
  });
});
