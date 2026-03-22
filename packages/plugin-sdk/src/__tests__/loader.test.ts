import { PluginLoader, PluginLoadError, PluginManifestError, validateManifest } from '../plugin-loader';
import type { PluginManifest } from '../types';

const baseManifest: PluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  type: 'integration',
  entrypoint: 'dist/index.js',
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest(baseManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects manifest missing required fields', () => {
    const result = validateManifest({ id: 'x', name: 'X' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    expect(result.errors.some((e) => e.includes('entrypoint'))).toBe(true);
  });

  it('rejects invalid plugin id', () => {
    const result = validateManifest({ ...baseManifest, id: 'INVALID ID!' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('rejects invalid version format', () => {
    const result = validateManifest({ ...baseManifest, version: 'not-semver' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('rejects invalid plugin type', () => {
    const result = validateManifest({ ...baseManifest, type: 'invalid-type' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('type'))).toBe(true);
  });

  it('rejects invalid permission', () => {
    const result = validateManifest({ ...baseManifest, permissions: ['super-power'] });
    expect(result.valid).toBe(false);
  });

  it('accepts all valid plugin types', () => {
    for (const type of ['agent', 'integration', 'workflow', 'theme'] as const) {
      expect(validateManifest({ ...baseManifest, type }).valid).toBe(true);
    }
  });

  it('accepts optional fields', () => {
    const result = validateManifest({
      ...baseManifest,
      description: 'A test plugin',
      author: 'Test Author',
      permissions: ['network', 'events'],
      unicoreVersion: '>=0.0.1',
    });
    expect(result.valid).toBe(true);
  });
});

describe('PluginLoader.createPlugin', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader();
  });

  it('creates a plugin from a manifest and factory', () => {
    const plugin = loader.createPlugin(baseManifest, (m) => ({
      manifest: m,
      activate: async () => {},
    }));
    expect(plugin.manifest.id).toBe('test-plugin');
    expect(typeof plugin.activate).toBe('function');
  });

  it('throws PluginManifestError for invalid manifest', () => {
    expect(() =>
      loader.createPlugin({ id: '' } as PluginManifest, (m) => ({
        manifest: m,
        activate: async () => {},
      })),
    ).toThrow(PluginManifestError);
  });

  it('exposes validation errors in PluginManifestError', () => {
    try {
      loader.createPlugin({ id: '' } as PluginManifest, (m) => ({
        manifest: m,
        activate: async () => {},
      }));
    } catch (err) {
      expect(err).toBeInstanceOf(PluginManifestError);
      expect((err as PluginManifestError).errors.length).toBeGreaterThan(0);
    }
  });

  it('throws PluginLoadError for missing file', async () => {
    await expect(loader.loadFromFile('/nonexistent/path/plugin.json')).rejects.toThrow(
      PluginLoadError,
    );
  });
});

describe('PluginLoader.loadFromManifest with dynamic import', () => {
  it('throws PluginLoadError when entrypoint does not exist', async () => {
    const loader = new PluginLoader();
    await expect(
      loader.loadFromManifest({ ...baseManifest, entrypoint: './nonexistent.js' }),
    ).rejects.toThrow(PluginLoadError);
  });
});
