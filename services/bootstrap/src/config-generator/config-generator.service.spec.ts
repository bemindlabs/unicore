import { Test, TestingModule } from '@nestjs/testing';
import { ConfigGeneratorService } from './config-generator.service';
import type { Template } from '../common/interfaces/template.interface';
import type { ProvisionRequestDto } from '../dto/provision-request.dto';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
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
    sentinel: true,
  },
  dashboard: { widgets: ['mrr', 'churn', 'signups'] },
  channels: ['email', 'web', 'slack'],
  workflows: ['trial_expiry', 'churn_risk'],
  ...overrides,
});

const makeRequest = (overrides: Partial<ProvisionRequestDto> = {}): ProvisionRequestDto =>
  ({
    bootstrapSecret: 'secret',
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

describe('ConfigGeneratorService', () => {
  let service: ConfigGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigGeneratorService],
    }).compile();
    service = module.get<ConfigGeneratorService>(ConfigGeneratorService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('generate — business fields', () => {
    it('maps businessName, template, locale, currency, timezone from request', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.business.name).toBe('Acme Corp');
      expect(config.business.template).toBe('saas');
      expect(config.business.locale).toBe('en');
      expect(config.business.currency).toBe('USD');
      expect(config.business.timezone).toBe('UTC');
    });

    it('includes industry when provided in request', () => {
      const config = service.generate(makeRequest({ industry: 'Technology' }), makeTemplate());
      expect(config.business.industry).toBe('Technology');
    });

    it('omits industry when not provided in request', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.business).not.toHaveProperty('industry');
    });

    it('returns empty integrations array', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.integrations).toEqual([]);
    });
  });

  describe('generate — ERP config', () => {
    it('copies ERP modules directly from template', () => {
      const template = makeTemplate();
      const config = service.generate(makeRequest(), template);
      expect(config.erp.modules).toEqual(template.erp);
    });

    it('sets ERP currency from request', () => {
      const config = service.generate(makeRequest({ currency: 'THB' }), makeTemplate());
      expect(config.erp.currency).toBe('THB');
    });

    it('sets ERP timezone from request', () => {
      const config = service.generate(makeRequest({ timezone: 'Asia/Bangkok' }), makeTemplate());
      expect(config.erp.timezone).toBe('Asia/Bangkok');
    });

    it('reflects disabled modules from template', () => {
      const template = makeTemplate({
        erp: { contacts: false, orders: false, inventory: false, invoicing: false, expenses: false, reports: false },
      });
      const config = service.generate(makeRequest(), template);
      expect(Object.values(config.erp.modules).every((v) => !v)).toBe(true);
    });
  });

  describe('generate — roles', () => {
    it('returns all 5 roles in order', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.roles.map((r) => r.role)).toEqual([
        'owner',
        'operator',
        'marketer',
        'finance',
        'viewer',
      ]);
    });

    it('always enables owner role even with empty template', () => {
      const emptyTemplate = makeTemplate({
        agents: { comms: false, finance: false, growth: false, ops: false, research: false, erp: false, builder: false },
        erp: { contacts: false, orders: false, inventory: false, invoicing: false, expenses: false, reports: false },
      });
      const config = service.generate(makeRequest(), emptyTemplate);
      const owner = config.roles.find((r) => r.role === 'owner');
      expect(owner?.enabled).toBe(true);
    });

    it('enables all roles when template has active agents', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.roles.every((r) => r.enabled)).toBe(true);
    });

    it('disables non-owner roles when template has no active agents or ERP modules', () => {
      const emptyTemplate = makeTemplate({
        agents: { comms: false, finance: false, growth: false, ops: false, research: false, erp: false, builder: false },
        erp: { contacts: false, orders: false, inventory: false, invoicing: false, expenses: false, reports: false },
      });
      const config = service.generate(makeRequest(), emptyTemplate);
      const nonOwner = config.roles.filter((r) => r.role !== 'owner');
      expect(nonOwner.every((r) => !r.enabled)).toBe(true);
    });

    it('enables other roles when only ERP modules are active (no agents)', () => {
      const erpOnlyTemplate = makeTemplate({
        agents: { comms: false, finance: false, growth: false, ops: false, research: false, erp: false, builder: false },
        erp: { contacts: true, orders: false, inventory: false, invoicing: false, expenses: false, reports: false },
      });
      const config = service.generate(makeRequest(), erpOnlyTemplate);
      const nonOwner = config.roles.filter((r) => r.role !== 'owner');
      expect(nonOwner.every((r) => r.enabled)).toBe(true);
    });
  });

  describe('generate — agents', () => {
    it('returns 9 agents total (router + 8 mapped types)', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.agents).toHaveLength(9);
    });

    it('places router agent first with full_auto autonomy and enabled=true', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      expect(config.agents[0]).toMatchObject({
        type: 'router',
        enabled: true,
        autonomy: 'full_auto',
      });
    });

    it('sets enabled agents to approval autonomy', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      const comms = config.agents.find((a) => a.type === 'comms');
      expect(comms?.enabled).toBe(true);
      expect(comms?.autonomy).toBe('approval');
    });

    it('sets disabled agents to suggest autonomy', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      const erpAgent = config.agents.find((a) => a.type === 'erp');
      expect(erpAgent?.enabled).toBe(false);
      expect(erpAgent?.autonomy).toBe('suggest');
    });

    it('adds channels to comms agent when enabled and template has channels', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      const comms = config.agents.find((a) => a.type === 'comms');
      expect(comms?.channels).toEqual(['email', 'web', 'slack']);
    });

    it('does not add channels to comms when template channels are empty', () => {
      const template = makeTemplate({ channels: [] });
      const config = service.generate(makeRequest(), template);
      const comms = config.agents.find((a) => a.type === 'comms');
      expect(comms?.channels).toBeUndefined();
    });

    it('does not add channels to comms when comms agent is disabled', () => {
      const template = makeTemplate({
        agents: { comms: false, finance: false, growth: false, ops: false, research: false, erp: false, builder: false },
      });
      const config = service.generate(makeRequest(), template);
      const comms = config.agents.find((a) => a.type === 'comms');
      expect(comms?.channels).toBeUndefined();
    });

    it('does not add channels to non-comms agents', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      const finance = config.agents.find((a) => a.type === 'finance');
      const growth = config.agents.find((a) => a.type === 'growth');
      expect(finance?.channels).toBeUndefined();
      expect(growth?.channels).toBeUndefined();
    });

    it('includes all 7 agent types: comms, finance, growth, ops, research, erp, builder', () => {
      const config = service.generate(makeRequest(), makeTemplate());
      const types = config.agents.map((a) => a.type);
      expect(types).toEqual(expect.arrayContaining(['comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder']));
    });
  });
});
