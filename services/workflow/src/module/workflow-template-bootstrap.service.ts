import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TemplateRegistryService } from '../registry/template-registry.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';

/**
 * WorkflowTemplateBootstrapService bridges the TemplateRegistryService and
 * WorkflowEngineService.
 *
 * On startup it loads all enabled pre-built template definitions from the
 * registry and registers them with the engine so they are available to
 * trigger handlers. This decouples template loading / validation from the
 * execution engine, keeping both services independently testable.
 */
@Injectable()
export class WorkflowTemplateBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowTemplateBootstrapService.name);

  constructor(
    private readonly registry: TemplateRegistryService,
    private readonly engine: WorkflowEngineService,
  ) {}

  onModuleInit(): void {
    const templates = this.registry.findAll(true); // enabled only

    for (const definition of templates) {
      this.engine.registerDefinition(definition);
    }

    this.logger.log(
      `Bootstrapped ${templates.length} pre-built workflow template(s) into the engine.`,
    );
  }
}
