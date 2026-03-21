jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReaddirSync = fs.readdirSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;

const mockTemplateData = {
  name: 'E-Commerce',
  description: 'E-commerce template for online stores',
  erp: {
    contacts: true,
    orders: true,
    inventory: true,
    invoicing: true,
    expenses: false,
    reports: false,
  },
  agents: {
    comms: true,
    finance: true,
    growth: true,
    ops: false,
    research: false,
    erp: true,
    builder: false,
  },
  dashboard: { widgets: ['revenue', 'orders', 'inventory'] },
  channels: ['line', 'facebook', 'web'],
  workflows: ['low_stock_alert', 'order_confirmation'],
};

const saasTemplateData = {
  name: 'SaaS',
  description: 'SaaS business template',
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
  },
  dashboard: { widgets: ['mrr', 'churn', 'signups'] },
  channels: ['email', 'web', 'slack'],
  workflows: ['trial_expiry', 'churn_risk'],
};

async function buildService(
  opts: {
    exists?: boolean;
    files?: string[];
    readImpl?: () => string;
  } = {},
): Promise<TemplatesService> {
  const { exists = true, files = ['ecommerce.json'], readImpl } = opts;

  jest.clearAllMocks();
  mockExistsSync.mockReturnValue(exists);
  mockReaddirSync.mockReturnValue(files);
  if (readImpl) {
    mockReadFileSync.mockImplementation(readImpl);
  } else {
    mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplateData));
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [TemplatesService],
  }).compile();

  const svc = module.get<TemplatesService>(TemplatesService);
  // Ensure lifecycle hook runs (compile() may or may not trigger it depending on NestJS version)
  svc.onModuleInit();
  return svc;
}

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(async () => {
    service = await buildService();
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('returns all loaded templates', () => {
      expect(service.findAll()).toHaveLength(1);
    });

    it('returns templates with id derived from filename (without .json extension)', () => {
      expect(service.findAll()[0].id).toBe('ecommerce');
    });

    it('returns templates with correct data', () => {
      const templates = service.findAll();
      expect(templates[0].name).toBe('E-Commerce');
      expect(templates[0].channels).toEqual(['line', 'facebook', 'web']);
    });

    it('returns empty array when templates directory does not exist', async () => {
      const s = await buildService({ exists: false, files: [] });
      expect(s.findAll()).toEqual([]);
    });

    it('returns multiple templates when multiple files exist', async () => {
      let callCount = 0;
      const s = await buildService({
        files: ['ecommerce.json', 'saas.json'],
        readImpl: () => {
          callCount++;
          return callCount === 1 ? JSON.stringify(mockTemplateData) : JSON.stringify(saasTemplateData);
        },
      });
      expect(s.findAll()).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns the template with matching id', () => {
      const template = service.findById('ecommerce');
      expect(template.id).toBe('ecommerce');
      expect(template.name).toBe('E-Commerce');
    });

    it('returns full template data including erp, agents, channels, workflows', () => {
      const template = service.findById('ecommerce');
      expect(template.erp).toMatchObject(mockTemplateData.erp);
      expect(template.agents).toMatchObject(mockTemplateData.agents);
      expect(template.channels).toEqual(['line', 'facebook', 'web']);
      expect(template.workflows).toEqual(['low_stock_alert', 'order_confirmation']);
    });

    it('throws NotFoundException for unknown template id', () => {
      expect(() => service.findById('unknown')).toThrow(NotFoundException);
    });

    it("throws NotFoundException with message containing the template id", () => {
      expect(() => service.findById('ghost')).toThrow("Template 'ghost' not found");
    });
  });

  describe('template loading from filesystem', () => {
    it('skips non-JSON files in the templates directory', async () => {
      const s = await buildService({
        files: ['ecommerce.json', 'README.md', '.gitkeep', 'notes.txt'],
      });
      expect(s.findAll()).toHaveLength(1);
    });

    it('handles malformed JSON gracefully and skips the file', async () => {
      const s = await buildService({
        files: ['ecommerce.json'],
        readImpl: () => '{ invalid json content {',
      });
      expect(s.findAll()).toEqual([]);
    });

    it('strips .json extension to produce the template id', async () => {
      const s = await buildService({ files: ['professional_services.json'] });
      expect(s.findAll()[0].id).toBe('professional_services');
    });

    it('continues loading remaining templates if one file fails to parse', async () => {
      let callCount = 0;
      const s = await buildService({
        files: ['broken.json', 'ecommerce.json'],
        readImpl: () => {
          callCount++;
          return callCount === 1 ? 'not valid json {{{{' : JSON.stringify(mockTemplateData);
        },
      });
      expect(s.findAll()).toHaveLength(1);
      expect(s.findById('ecommerce').name).toBe('E-Commerce');
    });

    it('attaches the id property to each loaded template', async () => {
      const s = await buildService({ files: ['saas.json'], readImpl: () => JSON.stringify(saasTemplateData) });
      expect(s.findAll()[0].id).toBe('saas');
    });
  });
});
