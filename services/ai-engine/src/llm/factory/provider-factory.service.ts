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

@Injectable()
export class ProviderFactoryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderFactoryService.name);
  private readonly registry = new Map<string, ILlmProvider>();

  /**
   * PROVIDER_CATALOG is the compile-time registry of all supported LLM provider
   * adapters.  It defines static metadata (key field names, known model IDs,
   * dashboard URLs) and is intentionally a compile-time constant — it controls
   * which adapters exist, not which are enabled at runtime.
   *
   * Runtime behaviour (which provider is active, which model is used, API keys,
   * primary/failover order) is controlled entirely by:
   *   1. Environment variables — LLM_PRIMARY_PROVIDER, LLM_FAILOVER_PROVIDERS,
   *      LLM_FAILOVER_ENABLED, <PROVIDER>_API_KEY, <PROVIDER>_DEFAULT_MODEL
   *   2. Settings table (loaded via /api/v1/settings/ai-config/keys on startup
   *      and on every POST /api/v1/llm/reload)
   *
   * To add support for a new provider: add an entry here AND implement the
   * corresponding adapter (OpenAiProvider-compatible or custom ILlmProvider).
   */
  private static readonly PROVIDER_CATALOG: Omit<ProviderInfo, 'configured'>[] = [
    { id: 'openai',     name: 'OpenAI',             keyField: 'openaiKey',     getKeyUrl: 'https://platform.openai.com/api-keys',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o4-mini'],                                                         defaultBaseUrl: 'https://api.openai.com/v1' },
    { id: 'anthropic',  name: 'Anthropic',           keyField: 'anthropicKey',  getKeyUrl: 'https://console.anthropic.com/settings/keys',   models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],                                       defaultBaseUrl: 'https://api.anthropic.com' },
    { id: 'deepseek',   name: 'DeepSeek',            keyField: 'deepseekKey',   getKeyUrl: 'https://platform.deepseek.com/api_keys',        models: ['deepseek-chat', 'deepseek-reasoner'],                                                                                  defaultBaseUrl: 'https://api.deepseek.com/v1' },
    { id: 'groq',       name: 'Groq',                keyField: 'groqKey',       getKeyUrl: 'https://console.groq.com/keys',                 models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],    description: 'Ultra-fast inference',  defaultBaseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'gemini',     name: 'Google Gemini',       keyField: 'geminiKey',     getKeyUrl: 'https://aistudio.google.com/apikey',            models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],                                                              defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    { id: 'moonshot',   name: 'Moonshot AI / Kimi',  keyField: 'moonshotKey',   getKeyUrl: 'https://platform.moonshot.cn/console/api-keys',  models: ['kimi-k2', 'moonshot-v1-128k', 'moonshot-v1-32k'],                                                                     defaultBaseUrl: 'https://api.moonshot.cn/v1' },
    { id: 'mistral',    name: 'Mistral AI',          keyField: 'mistralKey',    getKeyUrl: 'https://console.mistral.ai/api-keys/',           models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],                                                    defaultBaseUrl: 'https://api.mistral.ai/v1' },
    { id: 'xai',        name: 'xAI (Grok)',          keyField: 'xaiKey',        getKeyUrl: 'https://console.x.ai/',                         models: ['grok-3', 'grok-3-mini', 'grok-3-fast'],                                                                                defaultBaseUrl: 'https://api.x.ai/v1' },
    { id: 'openrouter', name: 'OpenRouter',          keyField: 'openrouterKey', getKeyUrl: 'https://openrouter.ai/keys',                    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'], description: '200+ models, free tier', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'together',   name: 'Together AI',         keyField: 'togetherKey',   getKeyUrl: 'https://api.together.xyz/settings/api-keys',    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],                                     defaultBaseUrl: 'https://api.together.xyz/v1' },
    { id: 'fireworks',  name: 'Fireworks AI',        keyField: 'fireworksKey',  getKeyUrl: 'https://fireworks.ai/api-keys',                 models: ['accounts/fireworks/models/llama-v3p1-70b-instruct'],                                                                   defaultBaseUrl: 'https://api.fireworks.ai/inference/v1' },
    { id: 'cohere',     name: 'Cohere',              keyField: 'cohereKey',     getKeyUrl: 'https://dashboard.cohere.com/api-keys',         models: ['command-r-plus', 'command-r', 'command-light'],                                                                        defaultBaseUrl: 'https://api.cohere.com/v1' },
    { id: 'ollama',     name: 'Ollama (local)',      keyField: 'ollamaToken',   getKeyUrl: '',                                              models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],                      description: 'Free, runs locally',    defaultBaseUrl: 'http://localhost:11434', keyOptional: true },
  ];

  /**
   * Primary provider ID — resolved on construction from LLM_PRIMARY_PROVIDER
   * env var (default: 'openai').  Overridden by the Settings table value
   * "defaultProvider" on each call to initProviders() if LLM_PRIMARY_PROVIDER
   * is not explicitly set.
   */
  private primaryProviderId: string;

  /**
   * Ordered failover chain — resolved from LLM_FAILOVER_PROVIDERS env var.
   * LLM_FAILOVER_ENABLED=false disables all failover (single-provider mode).
   */
  private failoverProviderIds: string[];
  private failoverEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.primaryProviderId = this.config.get<string>(
      'LLM_PRIMARY_PROVIDER',
      'openai',
    );
    this.failoverProviderIds = (
      this.config.get<string>('LLM_FAILOVER_PROVIDERS', 'anthropic,openrouter,deepseek,groq,gemini,moonshot,mistral,xai,together,fireworks,cohere,ollama')
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.failoverEnabled =
      this.config.get<string>('LLM_FAILOVER_ENABLED', 'true') === 'true';
  }

  async onModuleInit(): Promise<void> {
    await this.initProviders();
    this.logger.log(
      `Provider factory initialised. Primary: ${this.primaryProviderId}. ` +
        `Failover: [${this.failoverProviderIds.join(', ')}]. Failover enabled: ${this.failoverEnabled}`,
    );
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
   */
  async reloadProviders(): Promise<string[]> {
    this.registry.clear();
    await this.initProviders();
    const registered = [...this.registry.keys()];
    this.logger.log(`Providers reloaded: [${registered.join(', ')}]`);
    return registered;
  }

  private async initProviders(): Promise<void> {
    // 1. Try loading keys from API Gateway settings (saved via dashboard)
    let dbKeys: { openaiKey?: string; anthropicKey?: string; defaultProvider?: string; defaultModel?: string } = {};
    const gatewayUrl = this.config.get<string>('API_GATEWAY_URL', 'http://unicore-api-gateway:4000');
    try {
      const res = await fetch(`${gatewayUrl}/api/v1/settings/ai-config/keys`, {
        headers: { 'X-Internal-Service': 'ai-engine' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        dbKeys = (await res.json()) as typeof dbKeys;
        this.logger.log('Loaded API keys from settings database');
      }
    } catch {
      this.logger.debug('Could not fetch keys from API Gateway — using env vars');
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

      this.registry.set(
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
      this.registry.set(
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

    // OpenAI-compatible providers — all use OpenAiProvider with custom base URL
    const compatibleProviders = [
      { id: 'moonshot',   envKey: 'MOONSHOT_API_KEY',    dbKey: 'moonshotKey',    baseUrl: 'https://api.moonshot.cn/v1',                  defaultModel: 'kimi-k2' },
      { id: 'openrouter', envKey: 'OPENROUTER_API_KEY',  dbKey: 'openrouterKey',  baseUrl: 'https://openrouter.ai/api/v1',                defaultModel: 'openai/gpt-4o' },
      { id: 'deepseek',   envKey: 'DEEPSEEK_API_KEY',    dbKey: 'deepseekKey',    baseUrl: 'https://api.deepseek.com/v1',                 defaultModel: 'deepseek-chat' },
      { id: 'groq',       envKey: 'GROQ_API_KEY',        dbKey: 'groqKey',        baseUrl: 'https://api.groq.com/openai/v1',              defaultModel: 'llama-3.3-70b-versatile' },
      { id: 'gemini',     envKey: 'GEMINI_API_KEY',      dbKey: 'geminiKey',      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash' },
      { id: 'mistral',    envKey: 'MISTRAL_API_KEY',     dbKey: 'mistralKey',     baseUrl: 'https://api.mistral.ai/v1',                   defaultModel: 'mistral-large-latest' },
      { id: 'xai',        envKey: 'XAI_API_KEY',         dbKey: 'xaiKey',         baseUrl: 'https://api.x.ai/v1',                         defaultModel: 'grok-3-mini' },
      { id: 'together',   envKey: 'TOGETHER_API_KEY',    dbKey: 'togetherKey',    baseUrl: 'https://api.together.xyz/v1',                  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
      { id: 'fireworks',  envKey: 'FIREWORKS_API_KEY',   dbKey: 'fireworksKey',   baseUrl: 'https://api.fireworks.ai/inference/v1',        defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct' },
      { id: 'cohere',     envKey: 'COHERE_API_KEY',      dbKey: 'cohereKey',      baseUrl: 'https://api.cohere.com/v1',                   defaultModel: 'command-r-plus' },
    ] as const;

    const db = dbKeys as Record<string, string>;
    for (const p of compatibleProviders) {
      const key = this.config.get<string>(p.envKey) || db[p.dbKey];
      if (key) {
        const model = db[`${p.id}Model`] || this.config.get<string>(`${p.envKey.replace('_API_KEY', '_DEFAULT_MODEL')}`, p.defaultModel);
        const customBaseUrl = db[`${p.id}BaseUrl`] || p.baseUrl;
        this.registry.set(
          p.id,
          new OpenAiProvider(key, model, 'text-embedding-3-small', customBaseUrl, 'api-key', p.id),
        );
      }
    }

    // Resolve the active primary provider:
    // 1. LLM_PRIMARY_PROVIDER env var takes highest precedence (operator override)
    // 2. "defaultProvider" from the Settings table (set via the dashboard)
    // 3. Hardcoded default: 'openai'
    // Reset to env-configured value first so that clearing the DB setting
    // reverts to the env default rather than sticking to a previous DB value.
    const envPrimary = this.config.get<string>('LLM_PRIMARY_PROVIDER');
    if (envPrimary) {
      this.primaryProviderId = envPrimary;
    } else if (dbKeys.defaultProvider) {
      this.primaryProviderId = dbKeys.defaultProvider;
    } else {
      this.primaryProviderId = 'openai';
    }

    // Ollama is always registered — it's local and requires no key
    const ollamaUrl = db['ollamaBaseUrl'] || this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    const ollamaModel = db['ollamaModel'] || this.config.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.2');
    const ollamaToken = db['ollamaToken'] || this.config.get<string>('OLLAMA_AUTH_TOKEN', '');
    this.registry.set(
      'ollama',
      new OllamaProvider(
        ollamaUrl,
        ollamaModel,
        this.config.get<number>('LLM_REQUEST_TIMEOUT_MS', 120_000),
        ollamaToken || undefined,
      ),
    );
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

  /**
   * Ordered provider chain: primary first, then failovers (if enabled).
   */
  private getProviderChain(skipEmbedUnsupported = false): ILlmProvider[] {
    const ids = this.failoverEnabled
      ? [this.primaryProviderId, ...this.failoverProviderIds]
      : [this.primaryProviderId];

    return ids
      .filter((id) => this.registry.has(id))
      .map((id) => this.registry.get(id)!)
      .filter((p) => !skipEmbedUnsupported || p.providerId !== 'anthropic');
  }

  /**
   * Complete with automatic failover across the provider chain.
   */
  async completeWithFailover(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    preferredProvider?: string,
  ): Promise<LlmCompletionResult> {
    const chain = preferredProvider
      ? [
          this.getProvider(preferredProvider),
          ...this.getProviderChain().filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain();

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
  ): AsyncGenerator<LlmStreamChunk> {
    const primary = preferredProvider
      ? this.getProvider(preferredProvider)
      : this.getProvider(this.primaryProviderId);

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
      const provider = this.registry.get(id);
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
  ): Promise<LlmEmbeddingResult> {
    const chain = preferredProvider
      ? [
          this.getProvider(preferredProvider),
          ...this.getProviderChain(true).filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain(true);

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
