import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplateLoaderService } from '../src/loader/template-loader.service';

describe('TemplateLoaderService', () => {
  let service: TemplateLoaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplateLoaderService],
    }).compile();

    service = module.get<TemplateLoaderService>(TemplateLoaderService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('loads definitions from the templates directory on init', () => {
    service.onModuleInit();
    const definitions = service.getAll();

    // We have 3 pre-built templates
    expect(definitions.length).toBeGreaterThanOrEqual(3);
  });

  it('loads the order-to-invoice template', () => {
    service.onModuleInit();
    const definitions = service.getAll();
    const tpl = definitions.find((d) => d.id === 'order-to-invoice');
    expect(tpl).toBeDefined();
    expect(tpl!.trigger.type).toBe('erp.order.created');
    expect(tpl!.actions.length).toBeGreaterThanOrEqual(2);
  });

  it('loads the low-stock-reorder template', () => {
    service.onModuleInit();
    const definitions = service.getAll();
    const tpl = definitions.find((d) => d.id === 'low-stock-reorder');
    expect(tpl).toBeDefined();
    expect(tpl!.trigger.type).toBe('erp.inventory.low');
  });

  it('loads the invoice-overdue-reminder template', () => {
    service.onModuleInit();
    const definitions = service.getAll();
    const tpl = definitions.find((d) => d.id === 'invoice-overdue-reminder');
    expect(tpl).toBeDefined();
    expect(tpl!.trigger.type).toBe('erp.invoice.overdue');
  });

  it('assigns id from filename (no .json extension)', () => {
    service.onModuleInit();
    const definitions = service.getAll();
    for (const def of definitions) {
      expect(def.id).not.toContain('.json');
      expect(def.id.length).toBeGreaterThan(0);
    }
  });

  it('returns empty array when templates directory does not exist', () => {
    const loaderService = new TemplateLoaderService();
    // Override templatesDir to a non-existent path
    (loaderService as unknown as { templatesDir: string }).templatesDir =
      '/non-existent-path/templates';
    loaderService.onModuleInit();
    expect(loaderService.getAll()).toEqual([]);
  });

  it('skips files that fail JSON parsing', () => {
    const loaderService = new TemplateLoaderService();
    const tmpDir = fs.mkdtempSync('/tmp/wf-test-');
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), 'not valid json { }{');
    (loaderService as unknown as { templatesDir: string }).templatesDir = tmpDir;

    loaderService.onModuleInit();
    expect(loaderService.getAll()).toHaveLength(0);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
