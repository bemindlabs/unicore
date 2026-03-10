import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Template } from '../common/interfaces/template.interface';

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);
  private templates: Map<string, Template> = new Map();

  onModuleInit() {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    const templatesDir = path.resolve(__dirname, '../../../../templates');
    this.logger.log(`Loading templates from ${templatesDir}`);

    if (!fs.existsSync(templatesDir)) {
      this.logger.warn(`Templates directory not found: ${templatesDir}`);
      return;
    }

    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const id = path.basename(file, '.json');

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const template: Template = { id, ...data };
        this.templates.set(id, template);
        this.logger.log(`Loaded template: ${id}`);
      } catch (error) {
        this.logger.error(`Failed to load template ${file}: ${error}`);
      }
    }

    this.logger.log(`Loaded ${this.templates.size} templates`);
  }

  findAll(): Template[] {
    return Array.from(this.templates.values());
  }

  findById(id: string): Template {
    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundException(`Template '${id}' not found`);
    }
    return template;
  }
}
