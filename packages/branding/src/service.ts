// BrandingService — load, save, reset pro branding config
// Extends community with FileBrandingStorage and pro-specific methods.

import type { BrandingConfig, BrandingConfigPatch } from './types';
import { getDefaultConfig, findPreset } from './presets';

// Re-export community storage primitives so consumers get a single import point
export { MemoryBrandingStorage } from '@unicore/branding-base/service';
export type { BrandingStorage } from '@unicore/branding-base/service';

function isNodeError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** JSON file storage adapter (for Node.js server contexts). Pro feature. */
export class FileBrandingStorage {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<BrandingConfig | null> {
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as BrandingConfig;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(config: BrandingConfig): Promise<void> {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async clear(): Promise<void> {
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(this.filePath);
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') return;
      throw err;
    }
  }
}

export interface BrandingServiceOptions {
  storage: {
    load(): Promise<BrandingConfig | null>;
    save(config: BrandingConfig): Promise<void>;
    clear(): Promise<void>;
  };
  defaultAppName?: string;
}

/**
 * Pro BrandingService — manages full branding configuration lifecycle
 * including pro features: preset application, white-label flag toggle.
 */
export class BrandingService {
  private readonly storage: BrandingServiceOptions['storage'];
  private readonly defaultAppName: string;
  private cachedConfig: BrandingConfig | null = null;

  constructor(options: BrandingServiceOptions) {
    this.storage = options.storage;
    this.defaultAppName = options.defaultAppName ?? 'UniCore';
  }

  async load(): Promise<BrandingConfig> {
    if (this.cachedConfig) return this.cachedConfig;
    const stored = await this.storage.load();
    this.cachedConfig = stored ?? getDefaultConfig(this.defaultAppName);
    return this.cachedConfig;
  }

  async save(config: BrandingConfig): Promise<BrandingConfig> {
    const stamped: BrandingConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.save(stamped);
    this.cachedConfig = stamped;
    return stamped;
  }

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

  async reset(): Promise<BrandingConfig> {
    const current = this.cachedConfig ?? (await this.storage.load());
    const appName = current?.appName ?? this.defaultAppName;
    const defaults = getDefaultConfig(appName);
    this.cachedConfig = null;
    return this.save(defaults);
  }

  /**
   * Apply a named preset by ID without changing appName or removeUnicoreBranding.
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
      removeUnicoreBranding: current.removeUnicoreBranding,
    };
    return this.save(merged);
  }

  /**
   * Enable or disable the "remove UniCore branding" flag.
   * Requires the whiteLabelBranding license feature to have effect.
   */
  async setRemoveUnicoreBranding(enabled: boolean): Promise<BrandingConfig> {
    return this.patch({ removeUnicoreBranding: enabled });
  }

  invalidateCache(): void {
    this.cachedConfig = null;
  }
}
