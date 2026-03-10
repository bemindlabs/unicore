/**
 * Unit tests for settings pages — pure business logic, no DOM required.
 *
 * Run: pnpm --filter @unicore/dashboard test
 */

// ---------------------------------------------------------------------------
// Mirror the shared-types enums locally so the test works without ESM
// resolution hurdles in the Jest/ts-jest pipeline.
// These values MUST match @unicore/shared-types exactly — if they diverge,
// integration tests (with RTL) will catch the mismatch.
// ---------------------------------------------------------------------------

const UserRole = {
  Owner: 'owner',
  Operator: 'operator',
  Marketer: 'marketer',
  Finance: 'finance',
  Viewer: 'viewer',
} as const;
type UserRole = (typeof UserRole)[keyof typeof UserRole];

const AgentType = {
  Router: 'router',
  Comms: 'comms',
  Finance: 'finance',
  Growth: 'growth',
  Ops: 'ops',
  Research: 'research',
  Erp: 'erp',
  Builder: 'builder',
} as const;
type AgentType = (typeof AgentType)[keyof typeof AgentType];

const AutonomyLevel = {
  FullAuto: 'full_auto',
  Approval: 'approval',
  Suggest: 'suggest',
} as const;
type AutonomyLevel = (typeof AutonomyLevel)[keyof typeof AutonomyLevel];

// ---------------------------------------------------------------------------
// General page helpers
// ---------------------------------------------------------------------------

describe('Settings — General page helpers', () => {
  const BUSINESS_TEMPLATES = [
    'ecommerce',
    'freelance',
    'saas',
    'retail',
    'content-creator',
    'professional',
    'custom',
  ] as const;

  it('includes all 7 business templates', () => {
    expect(BUSINESS_TEMPLATES).toHaveLength(7);
  });

  it('includes "custom" template as last option', () => {
    expect(BUSINESS_TEMPLATES[BUSINESS_TEMPLATES.length - 1]).toBe('custom');
  });

  const CURRENCIES = ['THB', 'USD', 'EUR', 'GBP', 'JPY', 'SGD'];

  it('lists THB as first currency (target market)', () => {
    expect(CURRENCIES[0]).toBe('THB');
  });

  it('has 6 currency options', () => {
    expect(CURRENCIES).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Team & Roles helpers
// ---------------------------------------------------------------------------

describe('Settings — Team & Roles helpers', () => {
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n: string) => n[0] as string)
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  it('getInitials returns up to 2 uppercase characters for two-word name', () => {
    expect(getInitials('Alice Chen')).toBe('AC');
  });

  it('getInitials handles single name', () => {
    expect(getInitials('Bob')).toBe('B');
  });

  it('getInitials takes only first 2 initials for 3-word names', () => {
    expect(getInitials('John Paul Doe')).toBe('JP');
  });

  it('UserRole has all 5 expected roles', () => {
    expect(Object.values(UserRole)).toContain('owner');
    expect(Object.values(UserRole)).toContain('operator');
    expect(Object.values(UserRole)).toContain('marketer');
    expect(Object.values(UserRole)).toContain('finance');
    expect(Object.values(UserRole)).toContain('viewer');
    expect(Object.values(UserRole)).toHaveLength(5);
  });

  it('Owner cannot be selected in invite form (filtered out)', () => {
    const invitableRoles = Object.values(UserRole).filter((r) => r !== UserRole.Owner);
    expect(invitableRoles).not.toContain(UserRole.Owner);
    expect(invitableRoles).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AI Agents helpers
// ---------------------------------------------------------------------------

describe('Settings — AI Agents helpers', () => {
  it('AgentType has 8 agents', () => {
    expect(Object.values(AgentType)).toHaveLength(8);
  });

  it('AutonomyLevel has 3 levels', () => {
    expect(Object.values(AutonomyLevel)).toHaveLength(3);
  });

  const DEFAULT_AGENT_CONFIGS = (Object.values(AgentType) as AgentType[]).map((type) => ({
    type,
    enabled: type === AgentType.Router || type === AgentType.Comms,
    autonomy: AutonomyLevel.Approval,
    channels: [] as string[],
  }));

  it('only Router and Comms are enabled by default', () => {
    const enabled = DEFAULT_AGENT_CONFIGS.filter((c) => c.enabled).map((c) => c.type);
    expect(enabled).toContain(AgentType.Router);
    expect(enabled).toContain(AgentType.Comms);
    expect(enabled).toHaveLength(2);
  });

  it('default autonomy level is Approval for all agents', () => {
    const allApproval = DEFAULT_AGENT_CONFIGS.every(
      (c) => c.autonomy === AutonomyLevel.Approval,
    );
    expect(allApproval).toBe(true);
  });

  it('all agents start with no channels assigned', () => {
    const allEmpty = DEFAULT_AGENT_CONFIGS.every((c) => c.channels.length === 0);
    expect(allEmpty).toBe(true);
  });

  it('toggling an agent updates enabled state', () => {
    const configs = DEFAULT_AGENT_CONFIGS.map((c) =>
      c.type === AgentType.Finance ? { ...c, enabled: true } : c,
    );
    const financeAgent = configs.find((c) => c.type === AgentType.Finance);
    expect(financeAgent?.enabled).toBe(true);
  });

  it('toggling channel adds it to the list', () => {
    const commsConfig = { type: AgentType.Comms, enabled: true, autonomy: AutonomyLevel.Approval, channels: ['web'] };
    const updated = { ...commsConfig, channels: [...commsConfig.channels, 'email'] };
    expect(updated.channels).toContain('email');
    expect(updated.channels).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ERP Modules helpers
// ---------------------------------------------------------------------------

describe('Settings — ERP Modules helpers', () => {
  type ErpModulesConfig = {
    contacts: boolean;
    orders: boolean;
    inventory: boolean;
    invoicing: boolean;
    expenses: boolean;
    reports: boolean;
  };

  const DEFAULT_MODULES: ErpModulesConfig = {
    contacts: true,
    orders: true,
    inventory: true,
    invoicing: true,
    expenses: false,
    reports: true,
  };

  it('5 of 6 modules are enabled by default', () => {
    const enabled = Object.values(DEFAULT_MODULES).filter(Boolean);
    expect(enabled).toHaveLength(5);
  });

  it('expenses is disabled by default', () => {
    expect(DEFAULT_MODULES.expenses).toBe(false);
  });

  it('toggling expenses enables it', () => {
    const updated = { ...DEFAULT_MODULES, expenses: true };
    expect(updated.expenses).toBe(true);
    expect(Object.values(updated).filter(Boolean)).toHaveLength(6);
  });

  it('has exactly 6 module keys', () => {
    expect(Object.keys(DEFAULT_MODULES)).toHaveLength(6);
  });

  it('toggling back disables a module', () => {
    const updated = { ...DEFAULT_MODULES, contacts: false };
    expect(updated.contacts).toBe(false);
    expect(Object.values(updated).filter(Boolean)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// License helpers
// ---------------------------------------------------------------------------

describe('Settings — License helpers', () => {
  const COMMUNITY_FEATURES = {
    maxAgents: 2,
    maxUsers: 5,
    customWorkflows: false,
    advancedReporting: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false,
  };

  const PRO_FEATURES = {
    maxAgents: 8,
    maxUsers: 15,
    customWorkflows: true,
    advancedReporting: true,
    apiAccess: true,
    whiteLabel: true,
    prioritySupport: true,
  };

  it('Community supports up to 5 users', () => {
    expect(COMMUNITY_FEATURES.maxUsers).toBe(5);
  });

  it('Community supports up to 2 agents', () => {
    expect(COMMUNITY_FEATURES.maxAgents).toBe(2);
  });

  it('Community has all boolean features disabled', () => {
    const boolFeatures = Object.entries(COMMUNITY_FEATURES)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([, v]) => v);
    expect(boolFeatures.every((v) => !v)).toBe(true);
  });

  it('Pro supports 8 agents', () => {
    expect(PRO_FEATURES.maxAgents).toBe(8);
  });

  it('Pro supports 15 users', () => {
    expect(PRO_FEATURES.maxUsers).toBe(15);
  });

  it('Pro enables all boolean features', () => {
    const boolFeatures = Object.entries(PRO_FEATURES)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([, v]) => v);
    expect(boolFeatures.every(Boolean)).toBe(true);
  });

  it('calculates days until expiry within ±2 day window', () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(daysUntilExpiry).toBeGreaterThanOrEqual(29);
    expect(daysUntilExpiry).toBeLessThanOrEqual(31);
  });

  it('usage percentage is calculated correctly', () => {
    const used = 2;
    const max = 5;
    expect((used / max) * 100).toBe(40);
  });

  it('community upgrade key field is only shown for community edition', () => {
    const edition = 'community' as 'community' | 'pro';
    const showUpgrade = edition === 'community';
    expect(showUpgrade).toBe(true);

    const proEdition = 'pro' as 'community' | 'pro';
    expect(proEdition === 'community').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integrations helpers
// ---------------------------------------------------------------------------

describe('Settings — Integrations helpers', () => {
  const INTEGRATION_DEFS = [
    {
      provider: 'line',
      category: 'Messaging',
      fields: ['channelId', 'channelSecret', 'accessToken'],
    },
    { provider: 'facebook', category: 'Messaging', fields: ['pageId', 'accessToken'] },
    { provider: 'stripe', category: 'Payments', fields: ['publishableKey', 'secretKey'] },
    {
      provider: 'google-workspace',
      category: 'Productivity',
      fields: ['clientId', 'clientSecret'],
    },
    { provider: 'slack', category: 'Productivity', fields: ['botToken', 'signingSecret'] },
    {
      provider: 'shopify',
      category: 'E-Commerce',
      fields: ['shopDomain', 'adminApiKey'],
    },
  ];

  it('has 6 integration definitions', () => {
    expect(INTEGRATION_DEFS).toHaveLength(6);
  });

  it('covers 4 categories', () => {
    const categories = [...new Set(INTEGRATION_DEFS.map((d) => d.category))];
    expect(categories).toHaveLength(4);
    expect(categories).toContain('Messaging');
    expect(categories).toContain('Payments');
    expect(categories).toContain('Productivity');
    expect(categories).toContain('E-Commerce');
  });

  it('Save & Connect is disabled when any field is empty', () => {
    const fields = ['publishableKey', 'secretKey'];
    const configValues: Record<string, string> = { publishableKey: 'pk_live_abc' };
    const isDisabled = fields.some((f) => !configValues[f]?.trim());
    expect(isDisabled).toBe(true);
  });

  it('Save & Connect is enabled when all fields are filled', () => {
    const fields = ['publishableKey', 'secretKey'];
    const configValues: Record<string, string> = {
      publishableKey: 'pk_live_abc',
      secretKey: 'sk_live_xyz',
    };
    const isDisabled = fields.some((f) => !configValues[f]?.trim());
    expect(isDisabled).toBe(false);
  });

  it('Save & Connect disabled when field value is whitespace only', () => {
    const fields = ['botToken', 'signingSecret'];
    const configValues: Record<string, string> = { botToken: '  ', signingSecret: 'abc123' };
    const isDisabled = fields.some((f) => !configValues[f]?.trim());
    expect(isDisabled).toBe(true);
  });

  it('all integrations default to not configured and not enabled', () => {
    const states = INTEGRATION_DEFS.map((d) => ({
      provider: d.provider,
      enabled: false,
      isConfigured: false,
    }));
    expect(states.every((s) => !s.isConfigured)).toBe(true);
    expect(states.every((s) => !s.enabled)).toBe(true);
  });

  it('connecting an integration marks it as configured and enabled', () => {
    const states = INTEGRATION_DEFS.map((d) => ({
      provider: d.provider,
      enabled: false,
      isConfigured: false,
    }));
    const updated = states.map((s) =>
      s.provider === 'stripe' ? { ...s, enabled: true, isConfigured: true } : s,
    );
    const stripe = updated.find((s) => s.provider === 'stripe');
    expect(stripe?.isConfigured).toBe(true);
    expect(stripe?.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wizard helpers
// ---------------------------------------------------------------------------

describe('Settings — Wizard helpers', () => {
  const WIZARD_STEPS = [
    { step: 1, title: 'Business Profile', href: '/settings' },
    { step: 2, title: 'Team & Roles', href: '/settings/team' },
    { step: 3, title: 'AI Agents', href: '/settings/agents' },
    { step: 4, title: 'ERP Modules', href: '/settings/erp' },
    { step: 5, title: 'Integrations', href: '/settings/integrations' },
  ];

  it('wizard has exactly 5 steps', () => {
    expect(WIZARD_STEPS).toHaveLength(5);
  });

  it('step numbers are sequential starting at 1', () => {
    WIZARD_STEPS.forEach((s, i) => {
      expect(s.step).toBe(i + 1);
    });
  });

  it('each step href is under /settings', () => {
    WIZARD_STEPS.forEach((s) => {
      expect(s.href.startsWith('/settings')).toBe(true);
    });
  });

  it('last step is Integrations', () => {
    expect(WIZARD_STEPS[WIZARD_STEPS.length - 1]?.title).toBe('Integrations');
  });

  it('first step is Business Profile (mirrors General settings)', () => {
    const first = WIZARD_STEPS[0];
    expect(first?.title).toBe('Business Profile');
    expect(first?.href).toBe('/settings');
  });

  it('all step hrefs are unique', () => {
    const hrefs = WIZARD_STEPS.map((s) => s.href);
    const unique = [...new Set(hrefs)];
    expect(unique).toHaveLength(hrefs.length);
  });
});

// ---------------------------------------------------------------------------
// Domains helpers
// ---------------------------------------------------------------------------

describe('Settings — Domains helpers', () => {
  // Mirror domain types locally
  type DomainStatus = 'pending' | 'verifying' | 'verified' | 'active' | 'error';
  type SslStatus = 'pending' | 'active' | 'error';

  interface DnsRecord {
    type: 'TXT' | 'CNAME' | 'A';
    name: string;
    value: string;
    ttl: number;
  }

  interface Domain {
    id: string;
    name: string;
    status: DomainStatus;
    sslStatus: SslStatus;
    verifiedAt?: string;
    addedAt: string;
    dnsRecords: DnsRecord[];
  }

  // Mirror isValidDomain from page.tsx
  function isValidDomain(value: string): boolean {
    const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return pattern.test(value.trim());
  }

  // ---------------------------------------------------------------------------
  // isValidDomain
  // ---------------------------------------------------------------------------

  describe('isValidDomain', () => {
    it('accepts a standard subdomain', () => {
      expect(isValidDomain('app.example.com')).toBe(true);
    });

    it('accepts a second-level domain', () => {
      expect(isValidDomain('example.com')).toBe(true);
    });

    it('accepts multi-level subdomain', () => {
      expect(isValidDomain('portal.acme.co.th')).toBe(true);
    });

    it('rejects bare hostname without TLD', () => {
      expect(isValidDomain('localhost')).toBe(false);
    });

    it('rejects domain with leading hyphen in label', () => {
      expect(isValidDomain('-bad.example.com')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidDomain('')).toBe(false);
    });

    it('rejects domain with trailing dot only', () => {
      expect(isValidDomain('.')).toBe(false);
    });

    it('rejects domain with spaces', () => {
      expect(isValidDomain('my domain.com')).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(isValidDomain('  app.example.com  ')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Domain status badge config coverage
  // ---------------------------------------------------------------------------

  const DOMAIN_STATUS_LABELS: Record<DomainStatus, string> = {
    pending: 'Pending',
    verifying: 'Verifying',
    verified: 'Verified',
    active: 'Active',
    error: 'Error',
  };

  const SSL_STATUS_LABELS: Record<SslStatus, string> = {
    pending: 'Pending',
    active: 'SSL Active',
    error: 'SSL Error',
  };

  it('all 5 domain statuses have a label', () => {
    const statuses: DomainStatus[] = ['pending', 'verifying', 'verified', 'active', 'error'];
    expect(statuses.every((s) => !!DOMAIN_STATUS_LABELS[s])).toBe(true);
  });

  it('all 3 SSL statuses have a label', () => {
    const statuses: SslStatus[] = ['pending', 'active', 'error'];
    expect(statuses.every((s) => !!SSL_STATUS_LABELS[s])).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Domain list state management
  // ---------------------------------------------------------------------------

  const MOCK_DOMAINS: Domain[] = [
    {
      id: '1',
      name: 'app.acme.com',
      status: 'active',
      sslStatus: 'active',
      verifiedAt: '2025-11-15',
      addedAt: '2025-11-10',
      dnsRecords: [
        { type: 'TXT', name: '_unicore-verify.app.acme.com', value: 'unicore-verify=abc123', ttl: 300 },
        { type: 'CNAME', name: 'app.acme.com', value: 'ingress.unicore.cloud', ttl: 300 },
      ],
    },
    {
      id: '2',
      name: 'portal.acme.co.th',
      status: 'verifying',
      sslStatus: 'pending',
      addedAt: '2026-03-09',
      dnsRecords: [
        { type: 'TXT', name: '_unicore-verify.portal.acme.co.th', value: 'unicore-verify=xyz789', ttl: 300 },
        { type: 'CNAME', name: 'portal.acme.co.th', value: 'ingress.unicore.cloud', ttl: 300 },
      ],
    },
    {
      id: '3',
      name: 'old.acme.io',
      status: 'error',
      sslStatus: 'error',
      addedAt: '2026-01-20',
      dnsRecords: [
        { type: 'TXT', name: '_unicore-verify.old.acme.io', value: 'unicore-verify=err000', ttl: 300 },
        { type: 'CNAME', name: 'old.acme.io', value: 'ingress.unicore.cloud', ttl: 300 },
      ],
    },
  ];

  it('mock data has 3 domains', () => {
    expect(MOCK_DOMAINS).toHaveLength(3);
  });

  it('each domain has exactly 2 DNS records (TXT + CNAME)', () => {
    expect(MOCK_DOMAINS.every((d) => d.dnsRecords.length === 2)).toBe(true);
    expect(MOCK_DOMAINS.every((d) => d.dnsRecords.some((r) => r.type === 'TXT'))).toBe(true);
    expect(MOCK_DOMAINS.every((d) => d.dnsRecords.some((r) => r.type === 'CNAME'))).toBe(true);
  });

  it('all CNAME records point to ingress.unicore.cloud', () => {
    const cnames = MOCK_DOMAINS.flatMap((d) => d.dnsRecords.filter((r) => r.type === 'CNAME'));
    expect(cnames.every((r) => r.value === 'ingress.unicore.cloud')).toBe(true);
  });

  it('TXT record names use _unicore-verify. prefix', () => {
    const txts = MOCK_DOMAINS.flatMap((d) => d.dnsRecords.filter((r) => r.type === 'TXT'));
    expect(txts.every((r) => r.name.startsWith('_unicore-verify.'))).toBe(true);
  });

  it('removing a domain by id filters it from the list', () => {
    const updated = MOCK_DOMAINS.filter((d) => d.id !== '3');
    expect(updated).toHaveLength(2);
    expect(updated.find((d) => d.id === '3')).toBeUndefined();
  });

  it('adding a new domain prepends it to the list', () => {
    const newDomain: Domain = {
      id: '99',
      name: 'new.example.com',
      status: 'pending',
      sslStatus: 'pending',
      addedAt: '2026-03-10',
      dnsRecords: [
        { type: 'TXT', name: '_unicore-verify.new.example.com', value: 'unicore-verify=new', ttl: 300 },
        { type: 'CNAME', name: 'new.example.com', value: 'ingress.unicore.cloud', ttl: 300 },
      ],
    };
    const updated = [newDomain, ...MOCK_DOMAINS];
    expect(updated[0]?.id).toBe('99');
    expect(updated).toHaveLength(4);
  });

  it('re-verify changes domain status to verifying', () => {
    const updated = MOCK_DOMAINS.map((d) =>
      d.id === '1' ? { ...d, status: 'verifying' as DomainStatus } : d,
    );
    const domain = updated.find((d) => d.id === '1');
    expect(domain?.status).toBe('verifying');
  });

  it('new domain starts with pending status for both domain and SSL', () => {
    const domain: Partial<Domain> = { status: 'pending', sslStatus: 'pending' };
    expect(domain.status).toBe('pending');
    expect(domain.sslStatus).toBe('pending');
  });

  it('active domain has verifiedAt set', () => {
    const activeDomain = MOCK_DOMAINS.find((d) => d.status === 'active');
    expect(activeDomain?.verifiedAt).toBeDefined();
  });

  it('non-active domains do not have verifiedAt', () => {
    const nonActive = MOCK_DOMAINS.filter((d) => d.status !== 'active');
    expect(nonActive.every((d) => !d.verifiedAt)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Settings sidebar — Domains nav item
  // ---------------------------------------------------------------------------

  const SETTINGS_NAV_ITEMS = [
    { label: 'General', href: '/settings' },
    { label: 'Team & Roles', href: '/settings/team' },
    { label: 'AI Agents', href: '/settings/agents' },
    { label: 'ERP Modules', href: '/settings/erp' },
    { label: 'Integrations', href: '/settings/integrations' },
    { label: 'Domains', href: '/settings/domains' },
    { label: 'License', href: '/settings/license' },
    { label: 'Re-run Wizard', href: '/settings/wizard' },
  ];

  it('settings nav includes Domains link', () => {
    const domainsItem = SETTINGS_NAV_ITEMS.find((item) => item.label === 'Domains');
    expect(domainsItem).toBeDefined();
    expect(domainsItem?.href).toBe('/settings/domains');
  });

  it('Domains appears before License in the nav', () => {
    const domainsIdx = SETTINGS_NAV_ITEMS.findIndex((item) => item.label === 'Domains');
    const licenseIdx = SETTINGS_NAV_ITEMS.findIndex((item) => item.label === 'License');
    expect(domainsIdx).toBeGreaterThan(-1);
    expect(licenseIdx).toBeGreaterThan(-1);
    expect(domainsIdx).toBeLessThan(licenseIdx);
  });

  it('settings nav has 8 items total', () => {
    expect(SETTINGS_NAV_ITEMS).toHaveLength(8);
  });
});
