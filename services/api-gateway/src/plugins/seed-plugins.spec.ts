import { PLUGIN_CATALOGUE, seedPlugins, PluginSeedEntry } from './seed-plugins';

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma = {
  plugin: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Catalogue shape tests
// ---------------------------------------------------------------------------

describe('PLUGIN_CATALOGUE', () => {
  it('contains at least 10 plugins', () => {
    expect(PLUGIN_CATALOGUE.length).toBeGreaterThanOrEqual(10);
  });

  it('every plugin has required top-level fields', () => {
    for (const plugin of PLUGIN_CATALOGUE) {
      expect(plugin.name).toBeTruthy();
      expect(plugin.slug).toBeTruthy();
      expect(['ai', 'integration', 'workflow', 'ui', 'utility']).toContain(plugin.type);
      expect(plugin.author).toBeTruthy();
      expect(plugin.description).toBeTruthy();
      expect(plugin.icon).toBeTruthy();
      expect(typeof plugin.downloads).toBe('number');
      expect(plugin.downloads).toBeGreaterThanOrEqual(0);
      expect(typeof plugin.rating).toBe('number');
      expect(plugin.rating).toBeGreaterThanOrEqual(0);
      expect(plugin.rating).toBeLessThanOrEqual(5);
    }
  });

  it('every plugin has at least one version', () => {
    for (const plugin of PLUGIN_CATALOGUE) {
      expect(plugin.versions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every version has required fields', () => {
    for (const plugin of PLUGIN_CATALOGUE) {
      for (const version of plugin.versions) {
        expect(version.semver).toMatch(/^\d+\.\d+\.\d+$/);
        expect(version.changelog).toBeTruthy();
        expect(version.artifactUrl).toMatch(/^https:\/\//);
        expect(version.checksum).toMatch(/^sha256:/);
        expect(typeof version.compatibility).toBe('object');
      }
    }
  });

  it('all slugs are unique', () => {
    const slugs = PLUGIN_CATALOGUE.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('includes the required 10 named plugins', () => {
    const slugs = PLUGIN_CATALOGUE.map((p) => p.slug);
    const required = [
      'gpt4o-agent',
      'slack',
      'n8n-workflow-bridge',
      'analytics-dashboard',
      'custom-theme',
      'telegram-channel',
      'langchain-toolkit',
      'postgresql-connector',
      'redis-cache',
      'email-templates',
    ];
    for (const slug of required) {
      expect(slugs).toContain(slug);
    }
  });

  it('covers all plugin types', () => {
    const types = new Set(PLUGIN_CATALOGUE.map((p) => p.type));
    expect(types).toContain('ai');
    expect(types).toContain('integration');
    expect(types).toContain('workflow');
    expect(types).toContain('ui');
    expect(types).toContain('utility');
  });
});

// ---------------------------------------------------------------------------
// seedPlugins() behaviour tests
// ---------------------------------------------------------------------------

describe('seedPlugins()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates all plugins when none exist', async () => {
    mockPrisma.plugin.findUnique.mockResolvedValue(null);
    mockPrisma.plugin.create.mockResolvedValue({});

    const result = await seedPlugins(mockPrisma as any);

    expect(result.created).toBe(PLUGIN_CATALOGUE.length);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.plugin.create).toHaveBeenCalledTimes(PLUGIN_CATALOGUE.length);
  });

  it('skips existing plugins when force=false', async () => {
    mockPrisma.plugin.findUnique.mockResolvedValue({ id: 'existing' });
    mockPrisma.plugin.create.mockResolvedValue({});

    const result = await seedPlugins(mockPrisma as any, { force: false });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(PLUGIN_CATALOGUE.length);
    expect(mockPrisma.plugin.create).not.toHaveBeenCalled();
  });

  it('deletes and recreates existing plugins when force=true', async () => {
    mockPrisma.plugin.findUnique.mockResolvedValue({ id: 'existing' });
    mockPrisma.plugin.delete.mockResolvedValue({});
    mockPrisma.plugin.create.mockResolvedValue({});

    const result = await seedPlugins(mockPrisma as any, { force: true });

    expect(result.created).toBe(PLUGIN_CATALOGUE.length);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.plugin.delete).toHaveBeenCalledTimes(PLUGIN_CATALOGUE.length);
    expect(mockPrisma.plugin.create).toHaveBeenCalledTimes(PLUGIN_CATALOGUE.length);
  });

  it('creates each plugin with the latest semver as version field', async () => {
    mockPrisma.plugin.findUnique.mockResolvedValue(null);
    mockPrisma.plugin.create.mockResolvedValue({});

    await seedPlugins(mockPrisma as any);

    for (let i = 0; i < PLUGIN_CATALOGUE.length; i++) {
      const entry: PluginSeedEntry = PLUGIN_CATALOGUE[i];
      const latestSemver = entry.versions[entry.versions.length - 1].semver;
      const callData = mockPrisma.plugin.create.mock.calls[i][0].data;

      expect(callData.version).toBe(latestSemver);
      expect(callData.slug).toBe(entry.slug);
    }
  });

  it('embeds all versions in the create call', async () => {
    mockPrisma.plugin.findUnique.mockResolvedValue(null);
    mockPrisma.plugin.create.mockResolvedValue({});

    await seedPlugins(mockPrisma as any);

    for (let i = 0; i < PLUGIN_CATALOGUE.length; i++) {
      const entry: PluginSeedEntry = PLUGIN_CATALOGUE[i];
      const callData = mockPrisma.plugin.create.mock.calls[i][0].data;

      expect(callData.versions.create).toHaveLength(entry.versions.length);
    }
  });

  it('returns correct counts for mixed existing / new plugins', async () => {
    // First plugin exists, rest are new
    mockPrisma.plugin.findUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValue(null);
    mockPrisma.plugin.create.mockResolvedValue({});

    const result = await seedPlugins(mockPrisma as any);

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(PLUGIN_CATALOGUE.length - 1);
  });
});
