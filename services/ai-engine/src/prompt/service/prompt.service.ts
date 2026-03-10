import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface PromptVersion {
  version: number;
  content: string;
  createdAt: Date;
  description?: string;
}

export interface PromptTemplate {
  key: string;
  name: string;
  description?: string;
  versions: PromptVersion[];
  /** The active version number (defaults to latest) */
  activeVersion: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RenderOptions {
  /** Override the active version */
  version?: number;
  /** Strict mode throws if a variable is missing */
  strict?: boolean;
}

export interface RegisterTemplateDto {
  key: string;
  name: string;
  content: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateDto {
  content: string;
  description?: string;
}

@Injectable()
export class PromptService implements OnModuleInit {
  private readonly logger = new Logger(PromptService.name);
  private readonly store = new Map<string, PromptTemplate>();
  private readonly compiledCache = new Map<string, HandlebarsTemplateDelegate>();

  onModuleInit(): void {
    this.seedBuiltinTemplates();
    this.loadFromDisk();
    this.logger.log(`PromptService initialised with ${this.store.size} templates`);
  }

  // ── Registration & versioning ──────────────────────────────────────────────

  register(dto: RegisterTemplateDto): PromptTemplate {
    const existing = this.store.get(dto.key);

    if (existing) {
      // Create a new version
      const version = existing.versions.length + 1;
      existing.versions.push({
        version,
        content: dto.content,
        createdAt: new Date(),
        description: dto.description,
      });
      existing.activeVersion = version;
      this.invalidateCache(dto.key);
      this.logger.debug(`Template "${dto.key}" updated to version ${version}`);
      return existing;
    }

    const template: PromptTemplate = {
      key: dto.key,
      name: dto.name,
      description: dto.description,
      versions: [
        {
          version: 1,
          content: dto.content,
          createdAt: new Date(),
          description: dto.description,
        },
      ],
      activeVersion: 1,
      tags: dto.tags,
      metadata: dto.metadata,
    };

    this.store.set(dto.key, template);
    this.logger.debug(`Template "${dto.key}" registered (v1)`);
    return template;
  }

  update(key: string, dto: UpdateTemplateDto): PromptTemplate {
    const template = this.requireTemplate(key);
    const version = template.versions.length + 1;

    template.versions.push({
      version,
      content: dto.content,
      createdAt: new Date(),
      description: dto.description,
    });
    template.activeVersion = version;
    this.invalidateCache(key);
    this.logger.debug(`Template "${key}" updated to version ${version}`);
    return template;
  }

  setActiveVersion(key: string, version: number): PromptTemplate {
    const template = this.requireTemplate(key);
    const v = template.versions.find((v) => v.version === version);

    if (!v) {
      throw new NotFoundException(
        `Version ${version} does not exist for template "${key}". ` +
          `Available: [${template.versions.map((v) => v.version).join(', ')}]`,
      );
    }

    template.activeVersion = version;
    this.invalidateCache(key);
    return template;
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  get(key: string): PromptTemplate {
    return this.requireTemplate(key);
  }

  list(tag?: string): PromptTemplate[] {
    const all = [...this.store.values()];
    return tag ? all.filter((t) => t.tags?.includes(tag)) : all;
  }

  exists(key: string): boolean {
    return this.store.has(key);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(
    key: string,
    variables: Record<string, unknown> = {},
    options: RenderOptions = {},
  ): string {
    const template = this.requireTemplate(key);
    const version = options.version ?? template.activeVersion;
    const versionData = template.versions.find((v) => v.version === version);

    if (!versionData) {
      throw new NotFoundException(
        `Version ${version} not found for template "${key}"`,
      );
    }

    const cacheKey = `${key}@${version}`;
    let compiled = this.compiledCache.get(cacheKey);

    if (!compiled) {
      compiled = Handlebars.compile(versionData.content, {
        strict: options.strict ?? false,
        noEscape: true, // prompts should not HTML-escape values
      });
      this.compiledCache.set(cacheKey, compiled);
    }

    try {
      return compiled(variables);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to render template "${key}" v${version}: ${msg}`);
    }
  }

  /**
   * Render a raw template string (not registered) with Handlebars.
   */
  renderRaw(
    content: string,
    variables: Record<string, unknown> = {},
  ): string {
    const compiled = Handlebars.compile(content, { noEscape: true });
    return compiled(variables);
  }

  // ── Built-in templates ─────────────────────────────────────────────────────

  private seedBuiltinTemplates(): void {
    const builtins: RegisterTemplateDto[] = [
      {
        key: 'system:base',
        name: 'Base System Prompt',
        description: 'Default system prompt for UniCore AI agents',
        tags: ['system', 'builtin'],
        content:
          'You are a helpful AI assistant for UniCore, an AI-first platform for solopreneurs. ' +
          'Today is {{currentDate}}. Be concise, accurate, and actionable. ' +
          'Respond in {{language}}.',
      },
      {
        key: 'agent:summary',
        name: 'Content Summariser',
        description: 'Summarise a given piece of content',
        tags: ['agent', 'builtin', 'summary'],
        content:
          'Summarise the following content in {{maxSentences}} sentences or fewer. ' +
          'Focus on key facts and actionable insights.\n\n' +
          'Content:\n{{content}}',
      },
      {
        key: 'agent:extract-tasks',
        name: 'Task Extractor',
        description: 'Extract actionable tasks from unstructured text',
        tags: ['agent', 'builtin', 'tasks'],
        content:
          'Extract all actionable tasks from the following text. ' +
          'Return a JSON array of objects with keys: task (string), priority (high|medium|low), dueHint (string|null).\n\n' +
          'Text:\n{{text}}',
      },
      {
        key: 'rag:context-inject',
        name: 'RAG Context Injection',
        description: 'Inject retrieved context into a prompt',
        tags: ['rag', 'builtin'],
        content:
          'Use the following retrieved context to answer the question. ' +
          'Only use information from the context — do not fabricate.\n\n' +
          'Context:\n{{#each chunks}}- {{this}}\n{{/each}}\n' +
          'Question: {{question}}',
      },
    ];

    for (const tpl of builtins) {
      this.register(tpl);
    }
  }

  private loadFromDisk(): void {
    const templatesDir = path.join(process.cwd(), 'prompt-templates');
    if (!fs.existsSync(templatesDir)) return;

    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
    let loaded = 0;

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        const dto = JSON.parse(raw) as RegisterTemplateDto;
        this.register(dto);
        loaded++;
      } catch (err) {
        this.logger.warn(`Failed to load template file "${file}": ${String(err)}`);
      }
    }

    if (loaded > 0) {
      this.logger.log(`Loaded ${loaded} templates from disk`);
    }
  }

  private requireTemplate(key: string): PromptTemplate {
    const template = this.store.get(key);
    if (!template) {
      throw new NotFoundException(`Prompt template "${key}" not found`);
    }
    return template;
  }

  private invalidateCache(key: string): void {
    for (const cacheKey of this.compiledCache.keys()) {
      if (cacheKey.startsWith(`${key}@`)) {
        this.compiledCache.delete(cacheKey);
      }
    }
  }
}
