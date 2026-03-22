"use strict";
// BrandingService — load, save, reset branding config (community edition)
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandingService = exports.MemoryBrandingStorage = void 0;
const presets_1 = require("./presets");
/** In-memory storage adapter (useful for tests and SSR environments) */
class MemoryBrandingStorage {
    data = null;
    async load() {
        return this.data;
    }
    async save(config) {
        this.data = config;
    }
    async clear() {
        this.data = null;
    }
}
exports.MemoryBrandingStorage = MemoryBrandingStorage;
/**
 * BrandingService manages branding configuration lifecycle:
 * load from storage, save, reset to defaults, and apply partial patches.
 */
class BrandingService {
    storage;
    defaultAppName;
    cachedConfig = null;
    constructor(options) {
        this.storage = options.storage;
        this.defaultAppName = options.defaultAppName ?? 'UniCore';
    }
    /**
     * Load the branding config from storage.
     * Returns the stored config, or the default if none exists.
     * Result is cached in memory for the lifetime of this service instance.
     */
    async load() {
        if (this.cachedConfig)
            return this.cachedConfig;
        const stored = await this.storage.load();
        this.cachedConfig = stored ?? (0, presets_1.getDefaultConfig)(this.defaultAppName);
        return this.cachedConfig;
    }
    /**
     * Save a complete branding config to storage.
     * Automatically stamps `updatedAt`.
     */
    async save(config) {
        const stamped = {
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
    async patch(patch) {
        const current = await this.load();
        const merged = {
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
    async reset() {
        const current = this.cachedConfig ?? (await this.storage.load());
        const appName = current?.appName ?? this.defaultAppName;
        const defaults = (0, presets_1.getDefaultConfig)(appName);
        this.cachedConfig = null;
        return this.save(defaults);
    }
    /**
     * Apply a named preset by ID without changing appName.
     * Throws if the preset ID is not found.
     */
    async applyPreset(presetId) {
        const preset = (0, presets_1.findPreset)(presetId);
        if (!preset) {
            throw new Error(`Branding preset "${presetId}" not found.`);
        }
        const current = await this.load();
        const merged = {
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
    invalidateCache() {
        this.cachedConfig = null;
    }
}
exports.BrandingService = BrandingService;
//# sourceMappingURL=service.js.map