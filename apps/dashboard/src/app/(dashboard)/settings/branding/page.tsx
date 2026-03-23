'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paintbrush, Save, RotateCcw, CheckCircle, AlertCircle, Loader2, Crown, Lock } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label, Switch, Badge,
} from '@unicore/ui';
import { api } from '@/lib/api';
import { useLicense } from '@/hooks/use-license';

// ── Types ─────────────────────────────────────────────────────────────────

interface BrandingColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  onPrimary: string;
  muted: string;
  border: string;
  destructive: string;
}

interface FontConfig {
  family: string;
  url?: string;
  weights: string[];
}

interface BrandingConfig {
  appName: string;
  logoUrl: string;
  logoIconUrl: string;
  faviconUrl: string;
  colors: BrandingColors;
  bodyFont: FontConfig;
  headingFont: FontConfig;
  monoFont: FontConfig;
  removeUnicoreBranding: boolean;
  customCss: string;
  updatedAt: string;
}

// ── Presets ───────────────────────────────────────────────────────────────

const PRESETS: { id: string; name: string; colors: BrandingColors }[] = [
  {
    id: 'unicore-default', name: 'UniCore Default',
    colors: { primary: '#6366f1', secondary: '#10b981', accent: '#f59e0b', background: '#0f172a', surface: '#1e293b', onPrimary: '#ffffff', foreground: '#f1f5f9', muted: '#94a3b8', border: '#334155', destructive: '#ef4444' },
  },
  {
    id: 'midnight-blue', name: 'Midnight Blue',
    colors: { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6', background: '#0a0f1e', surface: '#111827', onPrimary: '#ffffff', foreground: '#e2e8f0', muted: '#64748b', border: '#1e3a5f', destructive: '#f87171' },
  },
  {
    id: 'rose-gold', name: 'Rose Gold',
    colors: { primary: '#f43f5e', secondary: '#fb923c', accent: '#fbbf24', background: '#1c0a0e', surface: '#2d1117', onPrimary: '#ffffff', foreground: '#fce7f3', muted: '#9f1239', border: '#4c0519', destructive: '#dc2626' },
  },
  {
    id: 'forest-green', name: 'Forest Green',
    colors: { primary: '#16a34a', secondary: '#0891b2', accent: '#84cc16', background: '#0a1a0e', surface: '#14532d', onPrimary: '#ffffff', foreground: '#dcfce7', muted: '#4ade80', border: '#166534', destructive: '#dc2626' },
  },
  {
    id: 'slate-light', name: 'Slate Light',
    colors: { primary: '#6366f1', secondary: '#0ea5e9', accent: '#f59e0b', background: '#f8fafc', surface: '#ffffff', onPrimary: '#ffffff', foreground: '#0f172a', muted: '#64748b', border: '#e2e8f0', destructive: '#ef4444' },
  },
  {
    id: 'chinjan-pixel', name: 'Chinjan Pixel Art',
    colors: { primary: '#ff6b9d', secondary: '#7ec8e3', accent: '#ffd93d', background: '#faf8f5', surface: '#ffffff', onPrimary: '#ffffff', foreground: '#2d2d2d', muted: '#9ca3af', border: '#e5e1dc', destructive: '#ef4444' },
  },
  {
    id: 'chinjan-pixel-dark', name: 'Chinjan Pixel Art (Dark)',
    colors: { primary: '#ff6b9d', secondary: '#7ec8e3', accent: '#ffd93d', background: '#1a1525', surface: '#251f35', onPrimary: '#ffffff', foreground: '#f0e8ff', muted: '#8b7faa', border: '#3d3555', destructive: '#ef4444' },
  },
];

const DEFAULT_CONFIG: BrandingConfig = {
  appName: 'UniCore',
  logoUrl: '',
  logoIconUrl: '',
  faviconUrl: '',
  colors: PRESETS[0].colors,
  bodyFont: { family: 'Inter', weights: ['regular', 'medium', 'semibold', 'bold'] },
  headingFont: { family: 'Inter', weights: ['semibold', 'bold'] },
  monoFont: { family: 'JetBrains Mono', weights: ['regular', 'medium'] },
  removeUnicoreBranding: false,
  customCss: '',
  updatedAt: '',
};

const COLOR_FIELDS: { key: keyof BrandingColors; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'onPrimary', label: 'On Primary' },
  { key: 'muted', label: 'Muted' },
  { key: 'border', label: 'Border' },
  { key: 'destructive', label: 'Destructive' },
];

// ── Color Picker ──────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          title={label}
        />
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground mb-0.5 block">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs h-7"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ── Live Preview ──────────────────────────────────────────────────────────

function LivePreview({ config }: { config: BrandingConfig }) {
  const { colors, appName } = config;
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: colors.background, borderColor: colors.border }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b text-xs font-semibold"
        style={{ background: colors.surface, borderColor: colors.border, color: colors.foreground }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: colors.primary, color: colors.onPrimary }}
        >
          {appName.slice(0, 1).toUpperCase()}
        </div>
        <span style={{ color: colors.foreground }}>{appName || 'App Name'}</span>
      </div>
      {/* Content */}
      <div className="p-3 space-y-2">
        <div className="text-xs font-semibold" style={{ color: colors.foreground }}>Dashboard Preview</div>
        <div className="flex gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: colors.primary, color: colors.onPrimary }}
          >
            Primary
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: colors.secondary, color: colors.onPrimary }}
          >
            Secondary
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: colors.accent, color: '#1a1a1a' }}
          >
            Accent
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: colors.destructive, color: '#ffffff' }}
          >
            Alert
          </span>
        </div>
        <div
          className="rounded p-2 text-[10px]"
          style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.muted }}
        >
          Surface card — muted text example
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function BrandingSettingsPage() {
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<BrandingConfig>('/api/v1/settings/branding');
      setConfig({ ...DEFAULT_CONFIG, ...data, colors: { ...DEFAULT_CONFIG.colors, ...(data.colors ?? {}) } });
    } catch {
      // Use defaults if not configured yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) setConfig((prev) => ({ ...prev, colors: { ...preset.colors } }));
  };

  const setColor = (key: keyof BrandingColors, value: string) => {
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await api.put<BrandingConfig>('/api/v1/settings/branding', config);
      setConfig({ ...DEFAULT_CONFIG, ...saved, colors: { ...DEFAULT_CONFIG.colors, ...(saved.colors ?? {}) } });
      setStatus({ type: 'success', message: 'Branding configuration saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setStatus(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Paintbrush className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Branding</h1>
          <p className="text-muted-foreground">Customize the look and feel of your UniCore instance</p>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${status.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>App name and logo assets shown across the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  value={config.appName}
                  onChange={(e) => setConfig((prev) => ({ ...prev, appName: e.target.value }))}
                  placeholder="UniCore"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={config.logoUrl}
                    onChange={(e) => setConfig((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoIconUrl">Logo Icon URL</Label>
                  <Input
                    id="logoIconUrl"
                    value={config.logoIconUrl}
                    onChange={(e) => setConfig((prev) => ({ ...prev, logoIconUrl: e.target.value }))}
                    placeholder="https://..."
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    value={config.faviconUrl}
                    onChange={(e) => setConfig((prev) => ({ ...prev, faviconUrl: e.target.value }))}
                    placeholder="https://..."
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Palette */}
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>Choose a preset or customize individual colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Preset selector */}
              <div className="space-y-2">
                <Label htmlFor="preset">Theme Preset</Label>
                <div className="flex gap-2">
                  <select
                    id="preset"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) applyPreset(e.target.value); }}
                  >
                    <option value="" disabled>Apply a preset…</option>
                    {PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {/* Preset swatches */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={p.name}
                      onClick={() => applyPreset(p.id)}
                      className="flex gap-0.5 rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all"
                    >
                      {[p.colors.primary, p.colors.secondary, p.colors.accent, p.colors.background].map((c, i) => (
                        <span key={i} className="block w-4 h-6" style={{ background: c }} />
                      ))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <ColorField
                    key={key}
                    label={label}
                    value={config.colors[key]}
                    onChange={(v) => setColor(key, v)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Font families for body, headings, and monospace text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  { key: 'bodyFont' as const, label: 'Body Font' },
                  { key: 'headingFont' as const, label: 'Heading Font' },
                  { key: 'monoFont' as const, label: 'Monospace Font' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm">{label}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={config[key].family}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, [key]: { ...prev[key], family: e.target.value } }))
                      }
                      placeholder="Font family (e.g. Inter)"
                    />
                    <Input
                      value={config[key].url ?? ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, [key]: { ...prev[key], url: e.target.value } }))
                      }
                      placeholder="Google Fonts URL (optional)"
                      className="text-xs"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* White-label & Custom CSS */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced</CardTitle>
              <CardDescription>White-label settings and custom CSS overrides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Remove UniCore Branding</p>
                  <p className="text-xs text-muted-foreground">Hide "Powered by UniCore" attribution — requires Pro license</p>
                </div>
                <Switch
                  checked={config.removeUnicoreBranding}
                  onCheckedChange={(v) => setConfig((prev) => ({ ...prev, removeUnicoreBranding: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customCss">Custom CSS</Label>
                <textarea
                  id="customCss"
                  value={config.customCss}
                  onChange={(e) => setConfig((prev) => ({ ...prev, customCss: e.target.value }))}
                  placeholder=":root { --radius: 0.5rem; }"
                  rows={6}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview (sticky sidebar) */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Live Preview</CardTitle>
                <CardDescription className="text-xs">Updates as you edit</CardDescription>
              </CardHeader>
              <CardContent>
                <LivePreview config={config} />
              </CardContent>
            </Card>

            {/* Color swatches summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Color Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {COLOR_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded border border-border shrink-0"
                        style={{ background: config.colors[key] }}
                      />
                      <span className="text-xs text-muted-foreground flex-1">{label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{config.colors[key]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}
