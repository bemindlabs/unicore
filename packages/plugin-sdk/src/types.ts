export type PluginType = 'agent' | 'integration' | 'workflow' | 'theme';

export type PluginStatus = 'inactive' | 'active' | 'error' | 'disabled';

export type PluginPermission =
  | 'network'
  | 'filesystem'
  | 'database'
  | 'events'
  | 'config'
  | 'ai'
  | 'workflow'
  | 'crm'
  | 'notifications';

export interface JSONSchemaObject {
  type?: string | string[];
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  default?: unknown;
  additionalProperties?: boolean | JSONSchemaObject;
  [key: string]: unknown;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  type: PluginType;
  entrypoint: string;
  permissions?: PluginPermission[];
  dependencies?: Record<string, string>;
  configSchema?: JSONSchemaObject;
  unicoreVersion?: string;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface PluginSandbox {
  hasPermission(permission: PluginPermission | string): boolean;
  assertPermission(permission: PluginPermission | string): void;
  grantedPermissions: ReadonlySet<string>;
}

export interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
  sandbox: PluginSandbox;
}

export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;
  configure?(config: Record<string, unknown>, context: PluginContext): Promise<void>;
}

export type PluginFactory = (manifest: PluginManifest) => Plugin;

export interface PluginRegistration {
  plugin: Plugin;
  status: PluginStatus;
  error?: Error;
  config: Record<string, unknown>;
  activatedAt?: Date;
  deactivatedAt?: Date;
}

export type PluginEventType =
  | 'install'
  | 'uninstall'
  | 'activate'
  | 'deactivate'
  | 'configure'
  | 'error';

export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  timestamp: Date;
  data?: unknown;
}

export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
