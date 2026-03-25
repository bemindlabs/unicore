"use strict";
// Default theme presets for @unicore/branding (community edition)
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANDING_PRESETS = exports.DEFAULT_PRESET_ID = void 0;
exports.findPreset = findPreset;
exports.getDefaultConfig = getDefaultConfig;
exports.DEFAULT_PRESET_ID = 'unicore-default';
exports.BRANDING_PRESETS = [
    {
        id: 'unicore-default',
        name: 'UniCore Default',
        description: 'The standard UniCore indigo / emerald palette.',
        config: {
            colors: {
                primary: '#6366f1', // indigo-500
                secondary: '#10b981', // emerald-500
                accent: '#f59e0b', // amber-500
                background: '#0f172a', // zinc-900
                surface: '#1e293b', // zinc-800
                onPrimary: '#ffffff',
                foreground: '#f1f5f9', // zinc-100
                muted: '#94a3b8', // zinc-400
                border: '#334155', // zinc-700
                destructive: '#ef4444',
            },
        },
    },
    {
        id: 'zinc-light',
        name: 'Zinc Light',
        description: 'Clean, light mode palette for modern SaaS products.',
        config: {
            colors: {
                primary: '#6366f1', // indigo-500
                secondary: '#0ea5e9', // sky-500
                accent: '#f59e0b', // amber-500
                background: '#f8fafc', // zinc-50
                surface: '#ffffff',
                onPrimary: '#ffffff',
                foreground: '#0f172a', // zinc-900
                muted: '#64748b', // zinc-500
                border: '#e2e8f0', // zinc-200
                destructive: '#ef4444',
            },
        },
    },
];
/**
 * Look up a preset by ID. Returns undefined if not found.
 */
function findPreset(id) {
    return exports.BRANDING_PRESETS.find((p) => p.id === id);
}
/**
 * Return the default UniCore preset config merged with the given appName.
 */
function getDefaultConfig(appName = 'UniCore') {
    const preset = findPreset(exports.DEFAULT_PRESET_ID);
    return {
        appName,
        colors: { ...preset.config.colors },
        updatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=presets.js.map