"use strict";
// Default theme presets for @unicore/branding (pro edition)
// Includes all community presets plus pro-exclusive themes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANDING_PRESETS = exports.DEFAULT_PRESET_ID = void 0;
exports.findPreset = findPreset;
exports.getDefaultConfig = getDefaultConfig;
const presets_1 = require("@unicore/branding-base/presets");
Object.defineProperty(exports, "DEFAULT_PRESET_ID", { enumerable: true, get: function () { return presets_1.DEFAULT_PRESET_ID; } });
const PRO_PRESETS = [
    {
        id: 'unicore-default',
        name: 'UniCore Default',
        description: 'The standard UniCore indigo / emerald palette.',
        config: {
            colors: {
                primary: '#6366f1', // indigo-500
                secondary: '#10b981', // emerald-500
                accent: '#f59e0b', // amber-500
                background: '#0f172a', // slate-900
                surface: '#1e293b', // slate-800
                onPrimary: '#ffffff',
                foreground: '#f1f5f9', // slate-100
                muted: '#94a3b8', // slate-400
                border: '#334155', // slate-700
                destructive: '#ef4444',
            },
        },
    },
    {
        id: 'midnight-blue',
        name: 'Midnight Blue',
        description: 'Deep navy tones for a professional enterprise look.',
        config: {
            colors: {
                primary: '#3b82f6', // blue-500
                secondary: '#6366f1', // indigo-500
                accent: '#8b5cf6', // violet-500
                background: '#0a0f1e',
                surface: '#111827',
                onPrimary: '#ffffff',
                foreground: '#e2e8f0',
                muted: '#64748b',
                border: '#1e3a5f',
                destructive: '#f87171',
            },
        },
    },
    {
        id: 'rose-gold',
        name: 'Rose Gold',
        description: 'Warm rose and gold tones for lifestyle and creative brands.',
        config: {
            colors: {
                primary: '#f43f5e', // rose-500
                secondary: '#fb923c', // orange-400
                accent: '#fbbf24', // amber-400
                background: '#1c0a0e',
                surface: '#2d1117',
                onPrimary: '#ffffff',
                foreground: '#fce7f3',
                muted: '#9f1239',
                border: '#4c0519',
                destructive: '#dc2626',
            },
        },
    },
    {
        id: 'forest-green',
        name: 'Forest Green',
        description: 'Natural greens for sustainability and eco-focused brands.',
        config: {
            colors: {
                primary: '#16a34a', // green-600
                secondary: '#0891b2', // cyan-600
                accent: '#84cc16', // lime-400
                background: '#0a1a0e',
                surface: '#14532d',
                onPrimary: '#ffffff',
                foreground: '#dcfce7',
                muted: '#4ade80',
                border: '#166534',
                destructive: '#dc2626',
            },
        },
    },
    {
        id: 'slate-light',
        name: 'Slate Light',
        description: 'Clean, light mode palette for modern SaaS products.',
        config: {
            colors: {
                primary: '#6366f1', // indigo-500
                secondary: '#0ea5e9', // sky-500
                accent: '#f59e0b', // amber-500
                background: '#f8fafc', // slate-50
                surface: '#ffffff',
                onPrimary: '#ffffff',
                foreground: '#0f172a', // slate-900
                muted: '#64748b', // slate-500
                border: '#e2e8f0', // slate-200
                destructive: '#ef4444',
            },
        },
    },
    {
        id: 'chinjan-pixel',
        name: 'Chinjan Pixel Art',
        description: 'Bright pastel pixel art theme with retro-gaming character mascots.',
        config: {
            colors: {
                primary: '#ff6b9d',
                secondary: '#7ec8e3',
                accent: '#ffd93d',
                background: '#faf8f5',
                surface: '#ffffff',
                onPrimary: '#ffffff',
                foreground: '#2d2d2d',
                muted: '#9ca3af',
                border: '#e5e1dc',
                destructive: '#ef4444',
            },
            bodyFont: { family: 'Nunito', weights: ['regular', 'medium', 'bold'] },
            headingFont: { family: 'Press Start 2P', weights: ['regular'] },
            monoFont: { family: 'VT323', weights: ['regular'] },
            characterTheme: { id: 'chinjan', enabled: true, animationLevel: 'full' },
        },
    },
    {
        id: 'chinjan-pixel-dark',
        name: 'Chinjan Pixel Art (Dark)',
        description: 'Dark variant of the pixel art character theme.',
        config: {
            colors: {
                primary: '#ff6b9d',
                secondary: '#7ec8e3',
                accent: '#ffd93d',
                background: '#1a1525',
                surface: '#251f35',
                onPrimary: '#ffffff',
                foreground: '#f0e8ff',
                muted: '#8b7faa',
                border: '#3d3555',
                destructive: '#ef4444',
            },
            bodyFont: { family: 'Nunito', weights: ['regular', 'medium', 'bold'] },
            headingFont: { family: 'Press Start 2P', weights: ['regular'] },
            monoFont: { family: 'VT323', weights: ['regular'] },
            characterTheme: { id: 'chinjan', enabled: true, animationLevel: 'full' },
        },
    },
];
exports.BRANDING_PRESETS = PRO_PRESETS;
/**
 * Look up a preset by ID. Returns undefined if not found.
 */
function findPreset(id) {
    const found = exports.BRANDING_PRESETS.find((p) => p.id === id);
    if (found)
        return found;
    // Fall back to community preset lookup for forward compatibility
    const community = (0, presets_1.findPreset)(id);
    if (!community)
        return undefined;
    return { ...community, config: { ...community.config } };
}
/**
 * Return the default UniCore preset config merged with the given appName and flags.
 */
function getDefaultConfig(appName = 'UniCore') {
    const preset = findPreset(presets_1.DEFAULT_PRESET_ID);
    return {
        appName,
        colors: { ...preset.config.colors },
        removeUnicoreBranding: false,
        updatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=presets.js.map