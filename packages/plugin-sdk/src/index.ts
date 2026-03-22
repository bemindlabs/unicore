// Types
export type {
  PluginType,
  PluginStatus,
  PluginPermission,
  JSONSchemaObject,
  PluginManifest,
  PluginLogger,
  PluginSandbox,
  PluginContext,
  Plugin,
  PluginFactory,
  PluginRegistration,
  PluginEventType,
  PluginEvent,
  PluginEventHandler,
  ValidationResult,
} from './types.js';

// Schema validation
export { validateSchema, MANIFEST_SCHEMA } from './schema-validator.js';
export { validateManifest } from './plugin-loader.js';

// Sandbox
export { PluginSandboxImpl, PermissionDeniedError, ALL_PERMISSIONS } from './sandbox.js';

// Event system
export { PluginEventEmitter } from './event-system.js';

// Loader
export { PluginLoader, PluginLoadError, PluginManifestError } from './plugin-loader.js';

// Lifecycle
export { PluginLifecycleManager, PluginLifecycleError } from './lifecycle-manager.js';

// Dependency resolution
export {
  resolveLoadOrder,
  satisfiesVersion,
  DependencyResolutionError,
} from './dependency-resolver.js';

// Convenience factory (backwards-compatible with original API)
export function definePlugin(
  manifest: import('./types.js').PluginManifest,
  activate: (ctx: import('./types.js').PluginContext) => Promise<void>,
  options?: {
    deactivate?: () => Promise<void>;
    configure?: (
      config: Record<string, unknown>,
      ctx: import('./types.js').PluginContext,
    ) => Promise<void>;
  },
): import('./types.js').Plugin {
  return {
    manifest,
    activate,
    deactivate: options?.deactivate,
    configure: options?.configure,
  };
}
