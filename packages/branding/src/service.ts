// BrandingService — load, save, reset branding config (community edition)

import type { BrandingConfig, BrandingConfigPatch } from './types';
import { getDefaultConfig, findPreset } from './presets';

/** Storage adapter interface — allows swapping out persistence layers */
export interface BrandingStorage {
  load(): Promise<BrandingConfig | null>;
  save(config: BrandingConfig): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory storage adapter (useful for tests and SSR environments) */
export class MemoryBrandingStorage implements BrandingStorage {
  private data: BrandingConfig | null = null;

  async load(): Promise<BrandingConfig | null> {
    return this.data;
  }

  async save(config: BrandingConfig): Promise<void> {
    this.data = config;
  }

  async clear(): Promise<void> {
    this.data = null;
  }
}

export interface BrandingServiceOptions {
  storage: BrandingStorage;
  /**
   * Default app name used when no config has been saved yet.
   * Defaults to "UniCore".
   */
  defaultAppName?: string;
}

/**
 * BrandingService manages branding configuration lifecycle:
 * load from storage, save, reset to defaults, and apply partial patches.
 */
export class BrandingService {
  private readonly storage: BrandingStorage;
  private readonly defaultAppName: string;
  private cachedConfig: BrandingConfig | null = null;

  constructor(options: BrandingServiceOptions) {
    this.storage = options.storage;
    this.defaultAppName = options.defaultAppName ?? 'UniCore';
  }

  /**
   * Load the branding config from storage.
   * Returns the stored config, or the default if none exists.
   * Result is cached in memory for the lifetime of this service instance.
   */
  async load(): Promise<BrandingConfig> {
    if (this.cachedConfig) return this.cachedConfig;

    const stored = await this.storage.load();
    this.cachedConfig = stored ?? getDefaultConfig(this.defaultAppName);
    return this.cachedConfig;
  }

  /**
   * Save a complete branding config to storage.
   * Automatically stamps `updatedAt`.
   */
  async save(config: BrandingConfig): Promise<BrandingConfig> {
    const stamped: BrandingConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.save(stamped);
    this.cachedConfig = stamped;
    return stamped;
  }

  /**
   * Apply a partial patch to the current config and save.
   * Deep-merges `colors` if provided.
   */
  async patch(patch: BrandingConfigPatch): Promise<BrandingConfig> {
    const current = await this.load();
    const merged: BrandingConfig = {
      ...current,
      ...patch,
      colors: patch.colors
        ? { ...current.colors, ...patch.colors }
        : current.colors,
    };
    return this.save(merged);
  }

  /**
   * Reset to the built-in default config and persist it.
   * Preserves `appName` from the currently saved config.
   */
  async reset(): Promise<BrandingConfig> {
    const current = this.cachedConfig ?? (await this.storage.load());
    const appName = current?.appName ?? this.defaultAppName;
    const defaults = getDefaultConfig(appName);
    this.cachedConfig = null;
    return this.save(defaults);
  }

  /**
   * Apply a named preset by ID without changing appName.
   * Throws if the preset ID is not found.
   */
  async applyPreset(presetId: string): Promise<BrandingConfig> {
    const preset = findPreset(presetId);
    if (!preset) {
      throw new Error(`Branding preset "${presetId}" not found.`);
    }
    const current = await this.load();
    const merged: BrandingConfig = {
      ...current,
      ...preset.config,
      colors: { ...preset.config.colors },
      appName: current.appName,
    };
    return this.save(merged);
  }

  /**
   * Invalidate the in-memory cache, forcing the next `load()` to re-read storage.
   */
  invalidateCache(): void {
    this.cachedConfig = null;
  }
}
