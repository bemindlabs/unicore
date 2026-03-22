"use strict";
// BrandingService — load, save, reset pro branding config
// Extends community with FileBrandingStorage and pro-specific methods.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandingService = exports.FileBrandingStorage = exports.MemoryBrandingStorage = void 0;
const presets_1 = require("./presets");
// Re-export community storage primitives so consumers get a single import point
var service_1 = require("@unicore/branding-base/service");
Object.defineProperty(exports, "MemoryBrandingStorage", { enumerable: true, get: function () { return service_1.MemoryBrandingStorage; } });
function isNodeError(err) {
    return typeof err === 'object' && err !== null && 'code' in err;
}
/** JSON file storage adapter (for Node.js server contexts). Pro feature. */
class FileBrandingStorage {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    async load() {
        try {
            const { readFile } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
            const raw = await readFile(this.filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch (err) {
            if (isNodeError(err) && err.code === 'ENOENT')
                return null;
            throw err;
        }
    }
    async save(config) {
        const { writeFile, mkdir } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
        const { dirname } = await Promise.resolve().then(() => __importStar(require('node:path')));
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
    }
    async clear() {
        try {
            const { unlink } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
            await unlink(this.filePath);
        }
        catch (err) {
            if (isNodeError(err) && err.code === 'ENOENT')
                return;
            throw err;
        }
    }
}
exports.FileBrandingStorage = FileBrandingStorage;
/**
 * Pro BrandingService — manages full branding configuration lifecycle
 * including pro features: preset application, white-label flag toggle.
 */
class BrandingService {
    storage;
    defaultAppName;
    cachedConfig = null;
    constructor(options) {
        this.storage = options.storage;
        this.defaultAppName = options.defaultAppName ?? 'UniCore';
    }
    async load() {
        if (this.cachedConfig)
            return this.cachedConfig;
        const stored = await this.storage.load();
        this.cachedConfig = stored ?? (0, presets_1.getDefaultConfig)(this.defaultAppName);
        return this.cachedConfig;
    }
    async save(config) {
        const stamped = {
            ...config,
            updatedAt: new Date().toISOString(),
        };
        await this.storage.save(stamped);
        this.cachedConfig = stamped;
        return stamped;
    }
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
    async reset() {
        const current = this.cachedConfig ?? (await this.storage.load());
        const appName = current?.appName ?? this.defaultAppName;
        const defaults = (0, presets_1.getDefaultConfig)(appName);
        this.cachedConfig = null;
        return this.save(defaults);
    }
    /**
     * Apply a named preset by ID without changing appName or removeUnicoreBranding.
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
            removeUnicoreBranding: current.removeUnicoreBranding,
        };
        return this.save(merged);
    }
    /**
     * Enable or disable the "remove UniCore branding" flag.
     * Requires the whiteLabelBranding license feature to have effect.
     */
    async setRemoveUnicoreBranding(enabled) {
        return this.patch({ removeUnicoreBranding: enabled });
    }
    invalidateCache() {
        this.cachedConfig = null;
    }
}
exports.BrandingService = BrandingService;
//# sourceMappingURL=service.js.map