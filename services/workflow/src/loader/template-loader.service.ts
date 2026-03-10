import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { WorkflowDefinition } from '../schema/workflow-definition.schema';
import type { WorkflowTemplateFile } from '../templates/workflow-template.interface';

/**
 * TemplateLoaderService reads pre-built workflow template JSON files from
 * disk and converts them into WorkflowDefinition objects compatible with
 * WorkflowEngineService.
 *
 * Templates are resolved from `src/templates/definitions/` relative to
 * this file, so they work from both the TypeScript source tree and the
 * compiled `dist/` output.
 */
@Injectable()
export class TemplateLoaderService implements OnModuleInit {
  private readonly logger = new Logger(TemplateLoaderService.name);

  /** Absolute path to the directory containing JSON template files. */
  readonly templatesDir: string = path.resolve(
    __dirname,
    '../templates/definitions',
  );

  private definitions: WorkflowDefinition[] = [];

  onModuleInit(): void {
    this.definitions = this.loadFromDisk();
    this.logger.log(
      `Loaded ${this.definitions.length} workflow template definition(s) from ${this.templatesDir}`,
    );
  }

  /**
   * Returns all successfully loaded WorkflowDefinitions.
   * Safe to call after onModuleInit; returns [] before that.
   */
  getAll(): WorkflowDefinition[] {
    return this.definitions;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private loadFromDisk(): WorkflowDefinition[] {
    if (!fs.existsSync(this.templatesDir)) {
      this.logger.warn(
        `Templates directory not found: ${this.templatesDir}. No pre-built templates will be loaded.`,
      );
      return [];
    }

    const jsonFiles = fs
      .readdirSync(this.templatesDir)
      .filter((f) => f.endsWith('.json'));

    const definitions: WorkflowDefinition[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(this.templatesDir, file);
      const templateId = path.basename(file, '.json');

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as WorkflowTemplateFile;

        const now = new Date().toISOString();
        const definition: WorkflowDefinition = {
          id: templateId,
          name: parsed.name,
          description: parsed.description,
          enabled: parsed.enabled,
          schemaVersion: parsed.schemaVersion,
          trigger: parsed.trigger as WorkflowDefinition['trigger'],
          actions: parsed.actions as WorkflowDefinition['actions'],
          createdAt: now,
          updatedAt: now,
        };

        definitions.push(definition);
        this.logger.debug(`Loaded template definition: ${templateId}`);
      } catch (err) {
        this.logger.error(
          `Failed to parse template file "${file}": ${String(err)}`,
        );
      }
    }

    return definitions;
  }
}
