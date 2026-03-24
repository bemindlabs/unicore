import type { BrandingConfig, BrandingConfigPatch } from './types';
export { MemoryBrandingStorage } from '@bemindlabs/unicore-branding-base/service';
export type { BrandingStorage } from '@bemindlabs/unicore-branding-base/service';
/** JSON file storage adapter (for Node.js server contexts). Pro feature. */
export declare class FileBrandingStorage {
    private readonly filePath;
    constructor(filePath: string);
    load(): Promise<BrandingConfig | null>;
    save(config: BrandingConfig): Promise<void>;
    clear(): Promise<void>;
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
export declare class BrandingService {
    private readonly storage;
    private readonly defaultAppName;
    private cachedConfig;
    constructor(options: BrandingServiceOptions);
    load(): Promise<BrandingConfig>;
    save(config: BrandingConfig): Promise<BrandingConfig>;
    patch(patch: BrandingConfigPatch): Promise<BrandingConfig>;
    reset(): Promise<BrandingConfig>;
    /**
     * Apply a named preset by ID without changing appName or removeUnicoreBranding.
     * Throws if the preset ID is not found.
     */
    applyPreset(presetId: string): Promise<BrandingConfig>;
    /**
     * Enable or disable the "remove UniCore branding" flag.
     * Requires the whiteLabelBranding license feature to have effect.
     */
    setRemoveUnicoreBranding(enabled: boolean): Promise<BrandingConfig>;
    invalidateCache(): void;
}
//# sourceMappingURL=service.d.ts.map