import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmEmbeddingOptions,
  LlmEmbeddingResult,
  LlmMessage,
  LlmStreamChunk,
  ProviderHealthStatus,
} from '../interfaces/llm-provider.interface';
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { OllamaProvider } from '../providers/ollama.provider';

export interface ProviderInfo {
  id: string;
  name: string;
  keyField: string;
  getKeyUrl: string;
  models: string[];
  description?: string;
  defaultBaseUrl: string;
  keyOptional?: boolean;
  configured: boolean;
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly attemptedProviders: string[],
    public readonly underlyingErrors: string[],
  ) {
    super(
      `All LLM providers failed. Attempted: [${attemptedProviders.join(', ')}]. ` +
        `Errors: ${underlyingErrors.join(' | ')}`,
    );
    this.name = 'ProviderUnavailableError';
  }
}

interface TenantProviders {
  registry: Map<string, ILlmProvider>;
  primaryProviderId: string;
  expiresAt: number;
}

@Injectable()
export class ProviderFactoryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderFactoryService.name);

  /**
   * Default registry — built from environment variables only (no tenant). Used
   * as a last resort when a request carries no tenantId, and kept for backward
   * compatibility with existing call sites/tests. It NEVER loads another
   * tenant's DB keys (GAPS #2: no global startup prefetch of a tenant's keys).
   */
  private readonly registry = new Map<string, ILlmProvider>();

  /**
   * GAPS #2 (residual fix): per-tenant provider registries. AI keys are read
   * from the gateway settings endpoint scoped to the CALLING tenant (forwarding
   * its `x-tenant-id`), and cached briefly per tenant — instead of a single
   * global startup load that only ever saw the DEMO tenant's keys.
   */
  private readonly tenantRegistries = new Map<string, TenantProviders>();
  private readonly TENANT_CACHE_TTL_MS = 60_000;

  /**
   * PROVIDER_CATALOG is the compile-time registry of all supported LLM provider
   * adapters. It defines static metadata (key field names, known model IDs,
   * dashboard URLs) and is intentionally a compile-time constant -- it controls
   * which adapters exist, not which are enabled at runtime.
   *
   * Runtime behaviour (which provider is active, which model is used, API keys,
   * primary/failover order) is controlled entirely by:
   *   1. Environment variables -- LLM_PRIMARY_PROVIDER, LLM_FAILOVER_PROVIDERS,
   *      LLM_FAILOVER_ENABLED, <PROVIDER>_API_KEY, <PROVIDER>_DEFAULT_MODEL
   *   2. Settings table (loaded via /api/v1/settings/ai-config/keys on startup
   *      and on every POST /api/v1/llm/reload)
   *
   * To add support for a new provider: add an entry here AND implement the
   * corresponding adapter (OpenAiProvider-compatible or custom ILlmProvider).
   */
  private static readonly PROVIDER_CATALOG: Omit<ProviderInfo, 'configured'>[] = [
    // Only the three wired adapter classes ship today: OpenAiProvider,
    // AnthropicProvider, OllamaProvider. Additional providers (DeepSeek, Groq,
    // Gemini, Moonshot/Kimi, Mistral, xAI/Grok, OpenRouter, Together, Fireworks,
    // Cohere) are on the roadmap — re-add an entry here once an adapter is wired.
    { id: 'openai',     name: 'OpenAI',             keyField: 'openaiKey',     getKeyUrl: 'https://platform.openai.com/api-keys',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o4-mini'],                                                         defaultBaseUrl: 'https://api.openai.com/v1' },
    { id: 'anthropic',  name: 'Anthropic',           keyField: 'anthropicKey',  getKeyUrl: 'https://console.anthropic.com/settings/keys',   models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],                                       defaultBaseUrl: 'https://api.anthropic.com' },
    { id: 'ollama',     name: 'Ollama (local)',      keyField: 'ollamaToken',   getKeyUrl: '',                                              models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],                      description: 'Free, runs locally',    defaultBaseUrl: 'http://localhost:11434', keyOptional: true },
  ];
  private primaryProviderId: string;
  private failoverProviderIds: string[];
  private failoverEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.primaryProviderId = this.config.get<string>(
      'LLM_PRIMARY_PROVIDER',
      'openai',
    );
    this.failoverProviderIds = (
      this.config.get<string>('LLM_FAILOVER_PROVIDERS', 'anthropic,ollama')
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.failoverEnabled =
      this.config.get<string>('LLM_FAILOVER_ENABLED', 'true') === 'true';
  }

  async onModuleInit(): Promise<void> {
    // Build the env-only default registry. We do NOT prefetch any tenant's DB
    // keys here (GAPS #2) — per-tenant keys are resolved per request below.
    this.primaryProviderId = await this.initProviders(this.registry, undefined);
    this.logger.log(
      `Provider factory initialised (env defaults). Primary: ${this.primaryProviderId}. ` +
        `Failover: [${this.failoverProviderIds.join(', ')}]. Failover enabled: ${this.failoverEnabled}`,
    );
  }

  /**
   * Resolve the provider registry for a given tenant, building (and caching) it
   * by fetching that tenant's keys from the gateway. Falls back to the env-only
   * default registry when no tenantId is supplied.
   */
  private async getRegistryFor(
    tenantId?: string,
  ): Promise<{ registry: Map<string, ILlmProvider>; primaryProviderId: string }> {
    if (!tenantId) {
      return { registry: this.registry, primaryProviderId: this.primaryProviderId };
    }

    const cached = this.tenantRegistries.get(tenantId);
    if (cached && cached.expiresAt > Date.now() && cached.registry.size > 0) {
      return { registry: cached.registry, primaryProviderId: cached.primaryProviderId };
    }

    const registry = new Map<string, ILlmProvider>();
    const primaryProviderId = await this.initProviders(registry, tenantId);
    this.tenantRegistries.set(tenantId, {
      registry,
      primaryProviderId,
      expiresAt: Date.now() + this.TENANT_CACHE_TTL_MS,
    });
    return { registry, primaryProviderId };
  }

  /**
   * List all known providers with their static metadata and configured status.
   */
  listProviders(): ProviderInfo[] {
    return ProviderFactoryService.PROVIDER_CATALOG.map((p) => ({
      ...p,
      configured: this.registry.has(p.id),
    }));
  }

  /**
   * List available models. If providerId is given, returns models for that provider only
   * (tries live API, falls back to static catalog). Otherwise returns all live models.
   */
  async listModels(providerId?: string): Promise<string[]> {
    if (providerId) {
      return this.listModelsForProvider(providerId);
    }

    const models: string[] = [];
    for (const [id, provider] of this.registry) {
      try {
        // OpenAI-compatible providers support /models endpoint
        const p = provider as any;
        if (p.client?.models?.list) {
          const response = await p.client.models.list();
          const data = response?.data ?? response?.body?.data ?? [];
          for (const m of data) {
            models.push(m.id ?? m.name ?? String(m));
          }
        }
      } catch (err) {
        this.logger.debug(`Could not list models from ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return models.sort();
  }

  private async listModelsForProvider(providerId: string): Promise<string[]> {
    const catalog = ProviderFactoryService.PROVIDER_CATALOG.find((p) => p.id === providerId);
    const provider = this.registry.get(providerId);
    if (provider) {
      try {
        const p = provider as any;
        if (p.client?.models?.list) {
          const response = await p.client.models.list();
          const data = response?.data ?? response?.body?.data ?? [];
          if (data.length > 0) {
            return data.map((m: any) => m.id ?? m.name ?? String(m)).sort();
          }
        }
      } catch (err) {
        this.logger.debug(`Could not list models from ${providerId}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return catalog?.models ?? [];
  }

  /**
   * Reload providers — called on startup and when keys change via settings UI.
   * Rebuilds the env-only default registry and drops all per-tenant caches so
   * the next request re-fetches fresh, tenant-scoped keys.
   */
  async reloadProviders(): Promise<string[]> {
    this.registry.clear();
    this.tenantRegistries.clear();
    this.primaryProviderId = await this.initProviders(this.registry, undefined);
    const registered = [...this.registry.keys()];
    this.logger.log(`Providers reloaded (env defaults; tenant caches cleared): [${registered.join(', ')}]`);
    return registered;
  }

  /**
   * Build the set of providers into `registry`, returning the resolved primary
   * provider id. When `tenantId` is given, the gateway keys endpoint is called
   * with `x-tenant-id` so only that tenant's keys are loaded (GAPS #2). With no
   * tenantId, only env vars / local providers are used (no DB-key prefetch).
   */
  private async initProviders(
    registry: Map<string, ILlmProvider>,
    tenantId?: string,
  ): Promise<string> {
    // 1. Try loading keys from API Gateway settings (saved via dashboard),
    //    scoped to the calling tenant when one is known.
    let dbKeys: { openaiKey?: string; anthropicKey?: string; defaultProvider?: string; defaultModel?: string } = {};
    const gatewayUrl = this.config.get<string>('API_GATEWAY_URL', 'http://unicore-api-gateway:4000');
    if (tenantId) {
      try {
        const res = await fetch(`${gatewayUrl}/api/v1/settings/ai-config/keys`, {
          headers: { 'X-Internal-Service': 'ai-engine', 'x-tenant-id': tenantId },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          dbKeys = (await res.json()) as typeof dbKeys;
          this.logger.debug(`Loaded API keys for tenant ${tenantId} from settings database`);
        }
      } catch {
        this.logger.debug(`Could not fetch keys for tenant ${tenantId} — using env vars`);
      }
    }

    // 2. DB keys from dashboard settings
    const openAiKey = dbKeys.openaiKey;
    const defaultModel = dbKeys.defaultModel || this.config.get<string>('OPENAI_DEFAULT_MODEL', 'gpt-4o');

    if (openAiKey) {
      const openAiAuthType = (dbKeys as Record<string, string>).openaiAuthType === 'oauth' ? 'oauth' : 'api-key';
      let openAiBaseUrl = (dbKeys as Record<string, string>).openaiBaseUrl || this.config.get<string>('OPENAI_BASE_URL');

      // For ChatGPT subscription tokens, use the chatgpt-to-api proxy
      if (openAiAuthType === 'oauth') {
        const proxyBase = this.config.get<string>('CHATGPT_PROXY_URL', 'http://unicore-chatgpt-proxy:8080');
        if (!openAiBaseUrl) {
          openAiBaseUrl = `${proxyBase}/v1`;
        }
        // Register the access token with the proxy
        const proxyAdminPw = this.config.get<string>('CHATGPT_PROXY_ADMIN_PASSWORD', 'unicore-proxy-admin');
        try {
          const res = await fetch(`${proxyBase}/admin/tokens`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': proxyAdminPw,
            },
            body: JSON.stringify([openAiKey]),
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            this.logger.log('Registered ChatGPT access token with proxy');
          } else {
            const body = await res.text().catch(() => '');
            this.logger.warn(`ChatGPT proxy token registration failed: ${res.status} ${body}`);
          }
        } catch (err) {
          this.logger.warn(`Could not reach ChatGPT proxy: ${err instanceof Error ? err.message : err}`);
        }
      }

      registry.set(
        'openai',
        new OpenAiProvider(
          openAiKey,
          defaultModel,
          'text-embedding-3-small',
          openAiBaseUrl,
          openAiAuthType,
        ),
      );
    }

    const anthropicKey = dbKeys.anthropicKey;
    if (anthropicKey) {
      registry.set(
        'anthropic',
        new AnthropicProvider(
          anthropicKey,
          dbKeys.defaultModel || this.config.get<string>(
            'ANTHROPIC_DEFAULT_MODEL',
            'claude-sonnet-4-20250514',
          ),
        ),
      );
    }

    // OpenAI-compatible providers — all use OpenAiProvider with custom base URL.
    // ROADMAP: only the three wired adapters (openai, anthropic, ollama) ship
    // today, so this list is intentionally empty. To wire an additional provider
    // (e.g. deepseek, groq, gemini, moonshot/kimi, mistral, xai/grok, openrouter,
    // together, fireworks, cohere), add its entry back here *and* to
    // PROVIDER_CATALOG above — no new adapter class is needed since they are all
    // OpenAI-compatible.
    const compatibleProviders: ReadonlyArray<{
      id: string;
      envKey: string;
      dbKey: string;
      baseUrl: string;
      defaultModel: string;
    }> = [];

    const db = dbKeys as Record<string, string>;
    for (const p of compatibleProviders) {
      const key = this.config.get<string>(p.envKey) || db[p.dbKey];
      if (key) {
        const model = db[`${p.id}Model`] || this.config.get<string>(`${p.envKey.replace('_API_KEY', '_DEFAULT_MODEL')}`, p.defaultModel);
        const customBaseUrl = db[`${p.id}BaseUrl`] || p.baseUrl;
        registry.set(
          p.id,
          new OpenAiProvider(key, model, 'text-embedding-3-small', customBaseUrl, 'api-key', p.id),
        );
      }
    }

    // Resolve the active primary provider:
    // 1. LLM_PRIMARY_PROVIDER env var takes highest precedence (operator override)
    // 2. "defaultProvider" from the Settings table (set via the dashboard)
    // 3. Hardcoded default: 'openai'
    let primaryProviderId: string;
    const envPrimary = this.config.get<string>('LLM_PRIMARY_PROVIDER');
    if (envPrimary) {
      primaryProviderId = envPrimary;
    } else if (dbKeys.defaultProvider) {
      primaryProviderId = dbKeys.defaultProvider;
    } else {
      primaryProviderId = 'openai';
    }

    // Ollama is always registered — it's local and requires no key
    const ollamaUrl = db['ollamaBaseUrl'] || this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    const ollamaModel = db['ollamaModel'] || this.config.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.2');
    const ollamaToken = db['ollamaToken'] || this.config.get<string>('OLLAMA_AUTH_TOKEN', '');
    registry.set(
      'ollama',
      new OllamaProvider(
        ollamaUrl,
        ollamaModel,
        this.config.get<number>('LLM_REQUEST_TIMEOUT_MS', 120_000),
        ollamaToken || undefined,
      ),
    );

    return primaryProviderId;
  }

  /**
   * Returns the named provider, or throws if it is not registered.
   */
  getProvider(providerId: string): ILlmProvider {
    const provider = this.registry.get(providerId);
    if (!provider) {
      throw new Error(`LLM provider "${providerId}" is not registered.`);
    }
    return provider;
  }

  /**
   * Returns all registered providers.
   */
  getAllProviders(): ILlmProvider[] {
    return [...this.registry.values()];
  }

  /** Look up a provider in a specific registry (throws if not registered). */
  private getProviderFrom(
    registry: Map<string, ILlmProvider>,
    providerId: string,
  ): ILlmProvider {
    const provider = registry.get(providerId);
    if (!provider) {
      throw new Error(`LLM provider "${providerId}" is not registered.`);
    }
    return provider;
  }

  /**
   * Ordered provider chain: primary first, then failovers (if enabled), drawn
   * from the supplied (tenant-scoped) registry.
   */
  private getProviderChain(
    registry: Map<string, ILlmProvider>,
    primaryProviderId: string,
    skipEmbedUnsupported = false,
  ): ILlmProvider[] {
    const ids = this.failoverEnabled
      ? [primaryProviderId, ...this.failoverProviderIds]
      : [primaryProviderId];

    return ids
      .filter((id) => registry.has(id))
      .map((id) => registry.get(id)!)
      .filter((p) => !skipEmbedUnsupported || p.providerId !== 'anthropic');
  }

  /**
   * Complete with automatic failover across the provider chain, using the
   * calling tenant's provider registry (GAPS #2).
   */
  async completeWithFailover(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    preferredProvider?: string,
    tenantId?: string,
  ): Promise<LlmCompletionResult> {
    const { registry, primaryProviderId } = await this.getRegistryFor(tenantId);
    const chain = preferredProvider
      ? [
          this.getProviderFrom(registry, preferredProvider),
          ...this.getProviderChain(registry, primaryProviderId).filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain(registry, primaryProviderId);

    const attempted: string[] = [];
    const errors: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.providerId);
      try {
        const result = await provider.complete(messages, options);
        if (attempted.length > 1) {
          this.logger.warn(
            `Failover succeeded with provider "${provider.providerId}" after failures: [${attempted.slice(0, -1).join(', ')}]`,
          );
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Provider "${provider.providerId}" failed: ${msg}`,
        );
        errors.push(`${provider.providerId}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Stream with failover — falls back to non-streaming complete on failover providers.
   */
  async *streamWithFailover(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    preferredProvider?: string,
    tenantId?: string,
  ): AsyncGenerator<LlmStreamChunk> {
    const { registry, primaryProviderId } = await this.getRegistryFor(tenantId);
    const primary = preferredProvider
      ? this.getProviderFrom(registry, preferredProvider)
      : this.getProviderFrom(registry, primaryProviderId);

    try {
      yield* primary.stream(messages, options);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Primary provider "${primary.providerId}" stream failed: ${msg}. Falling back to completion.`,
      );
    }

    // Failover: use completeWithFailover and emit as a single done chunk
    const fallbackProviders = this.failoverEnabled
      ? this.failoverProviderIds.filter((id) => id !== primary.providerId)
      : [];

    const attempted: string[] = [primary.providerId];
    const errors: string[] = [];

    for (const id of fallbackProviders) {
      const provider = registry.get(id);
      if (!provider) continue;

      attempted.push(id);
      try {
        const result = await provider.complete(messages, options);
        // Emit the full content as a stream of chunks for API compatibility
        const chunkSize = 20;
        for (let i = 0; i < result.content.length; i += chunkSize) {
          yield {
            delta: result.content.slice(i, i + chunkSize),
            done: false,
            provider: result.provider,
          };
        }
        yield {
          delta: '',
          done: true,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
        };
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${id}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Embed with failover, skipping providers that don't support embeddings.
   */
  async embedWithFailover(
    text: string,
    options?: LlmEmbeddingOptions,
    preferredProvider?: string,
    tenantId?: string,
  ): Promise<LlmEmbeddingResult> {
    const { registry, primaryProviderId } = await this.getRegistryFor(tenantId);
    const chain = preferredProvider
      ? [
          this.getProviderFrom(registry, preferredProvider),
          ...this.getProviderChain(registry, primaryProviderId, true).filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain(registry, primaryProviderId, true);

    const attempted: string[] = [];
    const errors: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.providerId);
      try {
        return await provider.embed(text, options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Provider "${provider.providerId}" embed failed: ${msg}`);
        errors.push(`${provider.providerId}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Run health checks on all registered providers.
   */
  async checkAllHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      [...this.registry.values()].map((p) => p.healthCheck()),
    );
  }
}
