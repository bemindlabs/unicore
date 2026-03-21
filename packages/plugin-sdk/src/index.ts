export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  type: 'agent' | 'integration' | 'workflow' | 'theme';
  entrypoint: string;
  permissions?: string[];
}

export interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;
}

export function definePlugin(manifest: PluginManifest, activate: (ctx: PluginContext) => Promise<void>): Plugin {
  return { manifest, activate };
}
