import type {
  Plugin,
  PluginContext,
  PluginLogger,
  PluginRegistration,
  PluginStatus,
} from './types.js';
import { PluginEventEmitter } from './event-system.js';
import { PluginSandboxImpl } from './sandbox.js';
import { validateSchema } from './schema-validator.js';

export class PluginLifecycleError extends Error {
  constructor(message: string, public readonly pluginId: string) {
    super(message);
    this.name = 'PluginLifecycleError';
  }
}

function createLogger(pluginId: string): PluginLogger {
  const prefix = `[plugin:${pluginId}]`;
  return {
    info: (msg, ...args) => console.log(prefix, msg, ...args),
    warn: (msg, ...args) => console.warn(prefix, msg, ...args),
    error: (msg, ...args) => console.error(prefix, msg, ...args),
    debug: (msg, ...args) => console.debug(prefix, msg, ...args),
  };
}

export class PluginLifecycleManager {
  private registry = new Map<string, PluginRegistration>();
  readonly events: PluginEventEmitter;

  constructor(events?: PluginEventEmitter) {
    this.events = events ?? new PluginEventEmitter();
  }

  register(plugin: Plugin): void {
    if (this.registry.has(plugin.manifest.id)) {
      throw new PluginLifecycleError(
        `Plugin '${plugin.manifest.id}' is already registered`,
        plugin.manifest.id,
      );
    }
    this.registry.set(plugin.manifest.id, {
      plugin,
      status: 'inactive',
      config: {},
    });
  }

  unregister(pluginId: string): void {
    const reg = this.getRegistration(pluginId);
    if (reg.status === 'active') {
      throw new PluginLifecycleError(
        `Cannot unregister active plugin '${pluginId}'. Deactivate it first.`,
        pluginId,
      );
    }
    this.registry.delete(pluginId);
  }

  async activate(pluginId: string, config: Record<string, unknown> = {}): Promise<void> {
    const reg = this.getRegistration(pluginId);

    if (reg.status === 'active') {
      throw new PluginLifecycleError(`Plugin '${pluginId}' is already active`, pluginId);
    }
    if (reg.status === 'disabled') {
      throw new PluginLifecycleError(`Plugin '${pluginId}' is disabled`, pluginId);
    }

    // Validate config against schema if provided
    if (reg.plugin.manifest.configSchema) {
      const result = validateSchema(config, reg.plugin.manifest.configSchema, 'config');
      if (!result.valid) {
        throw new PluginLifecycleError(
          `Invalid config for plugin '${pluginId}': ${result.errors.join('; ')}`,
          pluginId,
        );
      }
    }

    const sandbox = new PluginSandboxImpl(reg.plugin.manifest.permissions ?? []);
    const context: PluginContext = {
      pluginId,
      config,
      logger: createLogger(pluginId),
      sandbox,
    };

    try {
      await reg.plugin.activate(context);
      reg.status = 'active';
      reg.config = config;
      reg.activatedAt = new Date();
      reg.error = undefined;
      await this.events.emit('activate', pluginId, { config });
    } catch (err) {
      reg.status = 'error';
      reg.error = err instanceof Error ? err : new Error(String(err));
      await this.events.emit('error', pluginId, { error: reg.error });
      throw new PluginLifecycleError(
        `Plugin '${pluginId}' failed to activate: ${reg.error.message}`,
        pluginId,
      );
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const reg = this.getRegistration(pluginId);

    if (reg.status !== 'active') {
      throw new PluginLifecycleError(
        `Plugin '${pluginId}' is not active (status: ${reg.status})`,
        pluginId,
      );
    }

    try {
      await reg.plugin.deactivate?.();
      reg.status = 'inactive';
      reg.deactivatedAt = new Date();
      await this.events.emit('deactivate', pluginId);
    } catch (err) {
      reg.status = 'error';
      reg.error = err instanceof Error ? err : new Error(String(err));
      await this.events.emit('error', pluginId, { error: reg.error });
      throw new PluginLifecycleError(
        `Plugin '${pluginId}' failed to deactivate: ${reg.error.message}`,
        pluginId,
      );
    }
  }

  async configure(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const reg = this.getRegistration(pluginId);

    // Validate config against schema if provided
    if (reg.plugin.manifest.configSchema) {
      const result = validateSchema(config, reg.plugin.manifest.configSchema, 'config');
      if (!result.valid) {
        throw new PluginLifecycleError(
          `Invalid config for plugin '${pluginId}': ${result.errors.join('; ')}`,
          pluginId,
        );
      }
    }

    if (reg.plugin.configure) {
      const sandbox = new PluginSandboxImpl(reg.plugin.manifest.permissions ?? []);
      const context: PluginContext = {
        pluginId,
        config,
        logger: createLogger(pluginId),
        sandbox,
      };
      await reg.plugin.configure(config, context);
    }

    reg.config = { ...reg.config, ...config };
    await this.events.emit('configure', pluginId, { config });
  }

  disable(pluginId: string): void {
    const reg = this.getRegistration(pluginId);
    if (reg.status === 'active') {
      throw new PluginLifecycleError(
        `Cannot disable active plugin '${pluginId}'. Deactivate it first.`,
        pluginId,
      );
    }
    reg.status = 'disabled';
  }

  enable(pluginId: string): void {
    const reg = this.getRegistration(pluginId);
    if (reg.status !== 'disabled') {
      throw new PluginLifecycleError(
        `Plugin '${pluginId}' is not disabled (status: ${reg.status})`,
        pluginId,
      );
    }
    reg.status = 'inactive';
  }

  getStatus(pluginId: string): PluginStatus {
    return this.getRegistration(pluginId).status;
  }

  getRegistration(pluginId: string): PluginRegistration {
    const reg = this.registry.get(pluginId);
    if (!reg) {
      throw new PluginLifecycleError(`Plugin '${pluginId}' is not registered`, pluginId);
    }
    return reg;
  }

  getAll(): Map<string, PluginRegistration> {
    return new Map(this.registry);
  }

  getActive(): PluginRegistration[] {
    return [...this.registry.values()].filter((r) => r.status === 'active');
  }

  isRegistered(pluginId: string): boolean {
    return this.registry.has(pluginId);
  }

  /** Deactivate all active plugins in reverse registration order */
  async deactivateAll(): Promise<void> {
    const active = [...this.registry.entries()]
      .filter(([, r]) => r.status === 'active')
      .reverse();

    for (const [id] of active) {
      await this.deactivate(id);
    }
  }
}
