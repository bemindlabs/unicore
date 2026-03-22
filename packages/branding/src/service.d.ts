import type { BrandingConfig, BrandingConfigPatch } from './types';
/** Storage adapter interface — allows swapping out persistence layers */
export interface BrandingStorage {
    load(): Promise<BrandingConfig | null>;
    save(config: BrandingConfig): Promise<void>;
    clear(): Promise<void>;
}
/** In-memory storage adapter (useful for tests and SSR environments) */
export declare class MemoryBrandingStorage implements BrandingStorage {
    private data;
    load(): Promise<BrandingConfig | null>;
    save(config: BrandingConfig): Promise<void>;
    clear(): Promise<void>;
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
export declare class BrandingService {
    private readonly storage;
    private readonly defaultAppName;
    private cachedConfig;
    constructor(options: BrandingServiceOptions);
    /**
     * Load the branding config from storage.
     * Returns the stored config, or the default if none exists.
     * Result is cached in memory for the lifetime of this service instance.
     */
    load(): Promise<BrandingConfig>;
    /**
     * Save a complete branding config to storage.
     * Automatically stamps `updatedAt`.
     */
    save(config: BrandingConfig): Promise<BrandingConfig>;
    /**
     * Apply a partial patch to the current config and save.
     * Deep-merges `colors` if provided.
     */
    patch(patch: BrandingConfigPatch): Promise<BrandingConfig>;
    /**
     * Reset to the built-in default config and persist it.
     * Preserves `appName` from the currently saved config.
     */
    reset(): Promise<BrandingConfig>;
    /**
     * Apply a named preset by ID without changing appName.
     * Throws if the preset ID is not found.
     */
    applyPreset(presetId: string): Promise<BrandingConfig>;
    /**
     * Invalidate the in-memory cache, forcing the next `load()` to re-read storage.
     */
    invalidateCache(): void;
}
//# sourceMappingURL=service.d.ts.map