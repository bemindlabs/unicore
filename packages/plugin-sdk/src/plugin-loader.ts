import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin, PluginFactory, PluginManifest, ValidationResult } from './types.js';
import { validateSchema, MANIFEST_SCHEMA } from './schema-validator.js';

export class PluginLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PluginLoadError';
  }
}

export class PluginManifestError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = 'PluginManifestError';
  }
}

export function validateManifest(manifest: unknown): ValidationResult {
  return validateSchema(manifest, MANIFEST_SCHEMA, 'manifest');
}

export class PluginLoader {
  private factories = new Map<string, PluginFactory>();

  /**
   * Register a plugin factory for in-process plugin loading.
   * The factory is invoked with the manifest and must return a Plugin instance.
   */
  registerFactory(pluginType: string, factory: PluginFactory): void {
    this.factories.set(pluginType, factory);
  }

  /**
   * Load a plugin from a manifest JSON file path.
   * Dynamically imports the entrypoint module.
   */
  async loadFromFile(manifestPath: string): Promise<Plugin> {
    let raw: string;
    try {
      raw = await readFile(manifestPath, 'utf-8');
    } catch (err) {
      throw new PluginLoadError(`Cannot read manifest at '${manifestPath}'`, err);
    }

    let manifest: unknown;
    try {
      manifest = JSON.parse(raw);
    } catch (err) {
      throw new PluginLoadError(`Invalid JSON in manifest '${manifestPath}'`, err);
    }

    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new PluginManifestError(
        `Manifest validation failed for '${manifestPath}': ${validation.errors.join('; ')}`,
        validation.errors,
      );
    }

    return this.loadFromManifest(manifest as PluginManifest, dirname(manifestPath));
  }

  /**
   * Load a plugin from an already-parsed manifest object.
   * If basePath is provided, entrypoint is resolved relative to it.
   */
  async loadFromManifest(manifest: PluginManifest, basePath?: string): Promise<Plugin> {
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new PluginManifestError(
        `Invalid plugin manifest: ${validation.errors.join('; ')}`,
        validation.errors,
      );
    }

    const entrypointPath = basePath
      ? resolve(basePath, manifest.entrypoint)
      : resolve(manifest.entrypoint);

    let mod: { default?: Plugin | PluginFactory; plugin?: Plugin };
    try {
      mod = await import(pathToFileURL(entrypointPath).href);
    } catch (err) {
      throw new PluginLoadError(
        `Failed to import plugin entrypoint '${entrypointPath}'`,
        err,
      );
    }

    const exported = mod.default ?? mod.plugin;
    if (!exported) {
      throw new PluginLoadError(
        `Plugin entrypoint '${entrypointPath}' has no default export`,
      );
    }

    if (typeof exported === 'function') {
      // Factory function
      return (exported as PluginFactory)(manifest);
    }

    if (typeof exported === 'object' && typeof (exported as Plugin).activate === 'function') {
      return exported as Plugin;
    }

    throw new PluginLoadError(
      `Plugin entrypoint '${entrypointPath}' default export must be a Plugin object or factory function`,
    );
  }

  /**
   * Create a plugin directly from a manifest + factory without filesystem access.
   */
  createPlugin(manifest: PluginManifest, factory: PluginFactory): Plugin {
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new PluginManifestError(
        `Invalid plugin manifest: ${validation.errors.join('; ')}`,
        validation.errors,
      );
    }
    return factory(manifest);
  }
}
