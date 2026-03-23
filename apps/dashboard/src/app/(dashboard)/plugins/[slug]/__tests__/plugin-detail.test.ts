// Updated: 2026-03-23
/**
 * Unit tests for plugin detail page helpers and type contracts.
 * Runs in Node with Jest (no DOM required).
 */

// ---------------------------------------------------------------------------
// Inline helpers (mirrored from page.tsx — keeps tests self-contained)
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

type PluginCategory = 'agents' | 'apps' | 'workflows' | 'channels' | 'analytics' | 'security';

interface VersionEntry {
  version: string;
  date: string;
  changes: string[];
}

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  author: string;
  authorEmail: string;
  authorWebsite: string;
  version: string;
  category: PluginCategory;
  tags: string[];
  rating: number;
  reviewCount: number;
  installCount: number;
  icon: string;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  versionHistory: VersionEntry[];
  reviews: Review[];
}

// ---------------------------------------------------------------------------
// formatCount
// ---------------------------------------------------------------------------

describe('formatCount', () => {
  it('formats numbers below 1000 as plain strings', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(42)).toBe('42');
  });

  it('formats thousands with one decimal and "k" suffix', () => {
    expect(formatCount(1000)).toBe('1.0k');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(15420)).toBe('15.4k');
    expect(formatCount(12300)).toBe('12.3k');
  });

  it('rounds to one decimal place', () => {
    expect(formatCount(1050)).toBe('1.1k');
    expect(formatCount(1949)).toBe('1.9k');
  });
});

// ---------------------------------------------------------------------------
// Plugin type shape
// ---------------------------------------------------------------------------

describe('Plugin interface', () => {
  const plugin: Plugin = {
    id: '1',
    slug: 'gpt-4o-agent',
    name: 'GPT-4o Agent',
    description: 'Powerful agent',
    longDescription: 'Full description here',
    author: 'OpenAI Labs',
    authorEmail: 'plugins@openai.com',
    authorWebsite: 'https://openai.com',
    version: '2.1.0',
    category: 'agents',
    tags: ['gpt-4o', 'multimodal'],
    rating: 4.8,
    reviewCount: 234,
    installCount: 15420,
    icon: '🤖',
    featured: true,
    createdAt: '2025-12-01',
    updatedAt: '2026-02-15',
    permissions: ['Read conversation history', 'Make outbound API calls to OpenAI'],
    versionHistory: [
      { version: '2.1.0', date: '2026-02-15', changes: ['GPT-4o-mini fallback', 'Vision input pipeline'] },
      { version: '2.0.0', date: '2026-01-10', changes: ['Full GPT-4o support'] },
    ],
    reviews: [
      { id: 'r1', author: 'Alice M.', rating: 5, comment: 'Works flawlessly.', date: '2026-03-01' },
    ],
  };

  it('has required string fields', () => {
    expect(typeof plugin.id).toBe('string');
    expect(typeof plugin.slug).toBe('string');
    expect(typeof plugin.name).toBe('string');
    expect(typeof plugin.author).toBe('string');
    expect(typeof plugin.version).toBe('string');
  });

  it('has numeric rating between 0 and 5', () => {
    expect(plugin.rating).toBeGreaterThanOrEqual(0);
    expect(plugin.rating).toBeLessThanOrEqual(5);
  });

  it('has non-empty permissions array', () => {
    expect(Array.isArray(plugin.permissions)).toBe(true);
    expect(plugin.permissions.length).toBeGreaterThan(0);
  });

  it('has version history with changes arrays', () => {
    expect(Array.isArray(plugin.versionHistory)).toBe(true);
    plugin.versionHistory.forEach((entry) => {
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(Array.isArray(entry.changes)).toBe(true);
    });
  });

  it('has reviews with author and rating', () => {
    expect(Array.isArray(plugin.reviews)).toBe(true);
    plugin.reviews.forEach((review) => {
      expect(typeof review.id).toBe('string');
      expect(typeof review.author).toBe('string');
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    });
  });

  it('optional featured flag defaults to undefined', () => {
    const minPlugin: Plugin = { ...plugin, featured: undefined };
    expect(minPlugin.featured).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Config panel key-value logic
// ---------------------------------------------------------------------------

describe('config panel key-value builder', () => {
  function buildConfig(entries: Array<{ key: string; value: string }>): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    for (const e of entries) {
      if (e.key.trim()) config[e.key.trim()] = e.value;
    }
    return config;
  }

  it('converts valid entries to a config object', () => {
    const entries = [
      { key: 'apiKey', value: 'sk-abc123' },
      { key: 'model', value: 'gpt-4o' },
    ];
    expect(buildConfig(entries)).toEqual({ apiKey: 'sk-abc123', model: 'gpt-4o' });
  });

  it('skips entries with empty or whitespace-only keys', () => {
    const entries = [
      { key: '', value: 'ignored' },
      { key: '  ', value: 'also ignored' },
      { key: 'validKey', value: 'kept' },
    ];
    expect(buildConfig(entries)).toEqual({ validKey: 'kept' });
  });

  it('trims whitespace from keys', () => {
    const entries = [{ key: '  temperature  ', value: '0.7' }];
    expect(buildConfig(entries)).toEqual({ temperature: '0.7' });
  });

  it('returns empty object when all keys are blank', () => {
    expect(buildConfig([{ key: '', value: 'x' }])).toEqual({});
  });

  it('handles empty entries array', () => {
    expect(buildConfig([])).toEqual({});
  });

  it('last write wins for duplicate keys', () => {
    const entries = [
      { key: 'k', value: 'first' },
      { key: 'k', value: 'second' },
    ];
    expect(buildConfig(entries)).toEqual({ k: 'second' });
  });
});

// ---------------------------------------------------------------------------
// Version history helpers
// ---------------------------------------------------------------------------

describe('version history', () => {
  const history: VersionEntry[] = [
    { version: '2.1.0', date: '2026-02-15', changes: ['Feature A', 'Feature B'] },
    { version: '2.0.0', date: '2026-01-10', changes: ['Initial release'] },
  ];

  it('first entry is the latest version', () => {
    expect(history[0].version).toBe('2.1.0');
  });

  it('all entries have at least one change', () => {
    history.forEach((entry) => {
      expect(entry.changes.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Category icons map
// ---------------------------------------------------------------------------

describe('PluginCategory', () => {
  const categories: PluginCategory[] = ['agents', 'apps', 'workflows', 'channels', 'analytics', 'security'];

  it('covers all expected category values', () => {
    expect(categories).toHaveLength(6);
    expect(categories).toContain('agents');
    expect(categories).toContain('security');
  });
});
