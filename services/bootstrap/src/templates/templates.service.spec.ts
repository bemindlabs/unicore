import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';

jest.mock('fs');

import * as fs from 'fs';

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

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['ecommerce.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTemplateData));

    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplatesService],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('returns all loaded templates', () => {
      const templates = service.findAll();
      expect(templates).toHaveLength(1);
    });

    it('returns templates with id derived from filename', () => {
      const templates = service.findAll();
      expect(templates[0].id).toBe('ecommerce');
    });

    it('returns templates with correct data', () => {
      const templates = service.findAll();
      expect(templates[0].name).toBe('E-Commerce');
      expect(templates[0].channels).toEqual(['line', 'facebook', 'web']);
    });

    it('returns empty array when templates directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const emptyService = module.get<TemplatesService>(TemplatesService);
      expect(emptyService.findAll()).toEqual([]);
    });

    it('returns multiple templates when multiple files exist', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['ecommerce.json', 'saas.json']);
      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce(JSON.stringify(mockTemplateData))
        .mockReturnValueOnce(JSON.stringify(saasTemplateData));

      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const multiService = module.get<TemplatesService>(TemplatesService);
      expect(multiService.findAll()).toHaveLength(2);
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

    it('throws NotFoundException with descriptive message', () => {
      expect(() => service.findById('ghost')).toThrow("Template 'ghost' not found");
    });
  });

  describe('template loading from filesystem', () => {
    it('skips non-JSON files in the templates directory', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['ecommerce.json', 'README.md', '.gitkeep', 'notes.txt']);

      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const s = module.get<TemplatesService>(TemplatesService);
      expect(s.findAll()).toHaveLength(1);
    });

    it('handles malformed JSON gracefully and skips the file', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('{ invalid json content {');

      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const s = module.get<TemplatesService>(TemplatesService);
      expect(s.findAll()).toEqual([]);
    });

    it('loads templates with id stripped from .json extension', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['professional_services.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTemplateData));

      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const s = module.get<TemplatesService>(TemplatesService);
      const templates = s.findAll();
      expect(templates[0].id).toBe('professional_services');
    });

    it('continues loading remaining templates if one file fails to parse', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['broken.json', 'ecommerce.json']);
      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce('not valid json')
        .mockReturnValueOnce(JSON.stringify(mockTemplateData));

      const module: TestingModule = await Test.createTestingModule({
        providers: [TemplatesService],
      }).compile();
      const s = module.get<TemplatesService>(TemplatesService);
      expect(s.findAll()).toHaveLength(1);
      expect(s.findById('ecommerce').name).toBe('E-Commerce');
    });
  });
});
