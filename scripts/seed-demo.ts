#!/usr/bin/env npx tsx
// =============================================================================
// UniCore Demo Data Seeder
// Seeds all tables with realistic business data for customer demos
//
// Usage:
//   npx tsx scripts/seed-demo.ts
//   API_URL=http://localhost:4000 npx tsx scripts/seed-demo.ts
// =============================================================================

const API = process.env.API_URL || 'http://localhost:4000';
const ERP = `${API}/api/proxy/erp`;
const GATEWAY = `${API}/api/v1`;

let TOKEN = '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
let requestCount = 0;

async function api(method: string, url: string, body?: any, retries = 2): Promise<any> {
  // Throttle: max ~20 requests/sec to stay under nginx 30r/s limit
  requestCount++;
  if (requestCount % 15 === 0) await delay(1200);
  else await delay(80);

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '3');
    console.log(`  ⏳ Rate limited, waiting ${retryAfter}s...`);
    await delay(retryAfter * 1000);
    return api(method, url, body, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ ${method} ${url.replace(API, '')} → ${res.status}: ${text.substring(0, 120)}`);
    return null;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function login() {
  console.log('\n🔑 Authenticating...');
  const res = await api('POST', `${API}/auth/login`, {
    email: 'admin@unicore.dev',
    password: 'admin123',
  });
  if (!res?.accessToken) {
    console.error('Failed to login. Make sure admin@unicore.dev exists.');
    process.exit(1);
  }
  TOKEN = res.accessToken;
  console.log('  ✓ Logged in as admin@unicore.dev');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2) {
  return +(Math.random() * (max - min) + min).toFixed(decimals);
}

function pastDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function futureDate(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
}

// ─── Data Constants ──────────────────────────────────────────────────────────

const COMPANIES = [
  { name: 'TechVista Solutions', domain: 'techvista.io', industry: 'SaaS' },
  { name: 'GreenLeaf Organics', domain: 'greenleaf.co', industry: 'Food & Beverage' },
  { name: 'Atlas Logistics', domain: 'atlaslogistics.com', industry: 'Logistics' },
  { name: 'Pinnacle Finance Group', domain: 'pinnaclefg.com', industry: 'Finance' },
  { name: 'NovaMed Health', domain: 'novamed.health', industry: 'Healthcare' },
  { name: 'CloudForge Systems', domain: 'cloudforge.dev', industry: 'Cloud Infrastructure' },
  { name: 'BrightPath Education', domain: 'brightpath.edu', industry: 'Education' },
  { name: 'Meridian Real Estate', domain: 'meridianre.com', industry: 'Real Estate' },
  { name: 'Stellar Robotics', domain: 'stellarbot.ai', industry: 'Robotics' },
  { name: 'AquaPure Industries', domain: 'aquapure.com', industry: 'Manufacturing' },
  { name: 'Zenith Marketing Co', domain: 'zenithm.co', industry: 'Marketing' },
  { name: 'IronClad Security', domain: 'ironclad.sec', industry: 'Cybersecurity' },
];

const PEOPLE = [
  { first: 'Sarah', last: 'Chen', role: 'CTO' },
  { first: 'Marcus', last: 'Williams', role: 'VP Engineering' },
  { first: 'Emily', last: 'Rodriguez', role: 'Head of Procurement' },
  { first: 'James', last: 'O\'Brien', role: 'Director of Operations' },
  { first: 'Priya', last: 'Patel', role: 'CEO' },
  { first: 'David', last: 'Kim', role: 'Product Manager' },
  { first: 'Laura', last: 'Martinez', role: 'CFO' },
  { first: 'Alex', last: 'Thompson', role: 'IT Manager' },
  { first: 'Nina', last: 'Volkov', role: 'Head of Sales' },
  { first: 'Carlos', last: 'Rivera', role: 'Supply Chain Lead' },
  { first: 'Rebecca', last: 'Foster', role: 'Marketing Director' },
  { first: 'Hiroshi', last: 'Tanaka', role: 'Engineering Lead' },
  { first: 'Aisha', last: 'Okafor', role: 'Business Development' },
  { first: 'Thomas', last: 'Anderson', role: 'Purchasing Manager' },
  { first: 'Sophie', last: 'Dubois', role: 'COO' },
  { first: 'Michael', last: 'Chang', role: 'Technical Architect' },
  { first: 'Olivia', last: 'Bennett', role: 'Finance Director' },
  { first: 'Raj', last: 'Sharma', role: 'Operations Lead' },
  { first: 'Isabella', last: 'Costa', role: 'Startup Founder' },
  { first: 'Daniel', last: 'Park', role: 'DevOps Lead' },
  { first: 'Fatima', last: 'Al-Hassan', role: 'Partnership Manager' },
  { first: 'Lucas', last: 'Andersen', role: 'Account Executive' },
  { first: 'Maria', last: 'Santos', role: 'VP Sales' },
  { first: 'Kevin', last: 'Nguyen', role: 'Infrastructure Lead' },
  { first: 'Hannah', last: 'Wright', role: 'Growth Manager' },
];

const COUNTRIES = ['US', 'UK', 'DE', 'JP', 'SG', 'AU', 'CA', 'NL', 'SE', 'KR'];
const CITIES: Record<string, string[]> = {
  US: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston'],
  UK: ['London', 'Manchester', 'Edinburgh'],
  DE: ['Berlin', 'Munich', 'Hamburg'],
  JP: ['Tokyo', 'Osaka'],
  SG: ['Singapore'],
  AU: ['Sydney', 'Melbourne'],
  CA: ['Toronto', 'Vancouver'],
  NL: ['Amsterdam'],
  SE: ['Stockholm'],
  KR: ['Seoul'],
};

// ─── Products ────────────────────────────────────────────────────────────────

const PRODUCTS = [
  // SaaS & Software
  { sku: 'UC-STARTER', name: 'UniCore Starter Plan', desc: 'Monthly subscription - up to 5 users, community features', cat: 'Software License', price: 49, cost: 5, type: 'digital' },
  { sku: 'UC-PRO', name: 'UniCore Pro Plan', desc: 'Monthly subscription - up to 25 users, all Pro features', cat: 'Software License', price: 199, cost: 12, type: 'digital' },
  { sku: 'UC-ENTERPRISE', name: 'UniCore Enterprise Plan', desc: 'Monthly subscription - unlimited users, multi-tenancy, SLA', cat: 'Software License', price: 799, cost: 40, type: 'digital' },
  { sku: 'UC-AI-ADDON', name: 'AI Credits Pack (10K)', desc: '10,000 AI inference credits for agents and workflows', cat: 'Add-on', price: 29, cost: 8, type: 'digital' },
  { sku: 'UC-AI-ADDON-50K', name: 'AI Credits Pack (50K)', desc: '50,000 AI inference credits - bulk pricing', cat: 'Add-on', price: 99, cost: 30, type: 'digital' },
  { sku: 'UC-STORAGE', name: 'Extra Storage (100GB)', desc: 'Additional cloud storage for documents and RAG', cat: 'Add-on', price: 19, cost: 3, type: 'digital' },
  { sku: 'UC-WHITELABEL', name: 'White-Label License', desc: 'Custom branding and white-label deployment', cat: 'Software License', price: 299, cost: 15, type: 'digital' },
  { sku: 'UC-SSO', name: 'SSO Add-on', desc: 'SAML/OIDC single sign-on integration', cat: 'Add-on', price: 49, cost: 5, type: 'digital' },

  // Services
  { sku: 'SVC-ONBOARD', name: 'Onboarding Package', desc: 'Guided setup, data migration, and training (8 hours)', cat: 'Professional Services', price: 1200, cost: 600, type: 'service' },
  { sku: 'SVC-CUSTOM', name: 'Custom Integration', desc: 'Bespoke API integration development (per day)', cat: 'Professional Services', price: 1500, cost: 800, type: 'service' },
  { sku: 'SVC-TRAINING', name: 'Team Training Session', desc: '2-hour virtual training for up to 20 participants', cat: 'Professional Services', price: 500, cost: 200, type: 'service' },
  { sku: 'SVC-SUPPORT-PREM', name: 'Premium Support Plan', desc: '24/7 priority support with 1-hour SLA (monthly)', cat: 'Support', price: 399, cost: 150, type: 'service' },
  { sku: 'SVC-CONSULTING', name: 'AI Strategy Consulting', desc: 'Half-day AI strategy workshop with recommendations', cat: 'Professional Services', price: 2500, cost: 1000, type: 'service' },

  // Hardware / Physical
  { sku: 'HW-EDGE-01', name: 'UniCore Edge Device', desc: 'Pre-configured edge computing node for on-premise AI', cat: 'Hardware', price: 2999, cost: 1800, type: 'physical' },
  { sku: 'HW-DISPLAY', name: 'Smart Dashboard Display', desc: '24" touchscreen for office floor visualization', cat: 'Hardware', price: 899, cost: 450, type: 'physical' },
  { sku: 'MERCH-TSHIRT', name: 'UniCore Dev T-Shirt', desc: 'Premium cotton developer t-shirt with UniCore logo', cat: 'Merchandise', price: 35, cost: 12, type: 'physical' },
  { sku: 'MERCH-HOODIE', name: 'UniCore Hoodie', desc: 'Premium zip-up hoodie with embroidered logo', cat: 'Merchandise', price: 65, cost: 25, type: 'physical' },
  { sku: 'MERCH-STICKER', name: 'Sticker Pack (10 pcs)', desc: 'Holographic dev stickers - assorted designs', cat: 'Merchandise', price: 8, cost: 1, type: 'physical' },
];

// ─── Expense Templates ──────────────────────────────────────────────────────

const EXPENSE_TEMPLATES = [
  { title: 'AWS Infrastructure - March', cat: 'SOFTWARE', amount: 4280, vendor: 'Amazon Web Services' },
  { title: 'GitHub Enterprise License', cat: 'SOFTWARE', amount: 1260, vendor: 'GitHub' },
  { title: 'Figma Team Plan Renewal', cat: 'SOFTWARE', amount: 540, vendor: 'Figma Inc.' },
  { title: 'Office Rent - Q1', cat: 'RENT', amount: 8500, vendor: 'WeWork' },
  { title: 'Google Workspace Annual', cat: 'SOFTWARE', amount: 2160, vendor: 'Google LLC' },
  { title: 'Cloudflare Enterprise', cat: 'SOFTWARE', amount: 2400, vendor: 'Cloudflare Inc.' },
  { title: 'Team Offsite - Bangkok', cat: 'TRAVEL', amount: 6800, vendor: 'Various' },
  { title: 'Conference Booth - Web Summit', cat: 'ADVERTISING', amount: 5500, vendor: 'Web Summit Ltd' },
  { title: 'Legal - Terms of Service Review', cat: 'LEGAL', amount: 3200, vendor: 'Baker & Associates' },
  { title: 'Laptop - New Hire (M3 MacBook)', cat: 'EQUIPMENT', amount: 2499, vendor: 'Apple Inc.' },
  { title: 'SSL Wildcard Certificate', cat: 'SOFTWARE', amount: 199, vendor: 'DigiCert' },
  { title: 'Slack Business+ Annual', cat: 'SOFTWARE', amount: 1512, vendor: 'Salesforce' },
  { title: 'Linear Team Plan', cat: 'SOFTWARE', amount: 480, vendor: 'Linear Inc.' },
  { title: 'Vercel Pro Plan', cat: 'SOFTWARE', amount: 240, vendor: 'Vercel Inc.' },
  { title: 'Team Lunch - Sprint Review', cat: 'MEALS_ENTERTAINMENT', amount: 320, vendor: 'Local Restaurant' },
  { title: 'DataDog Monitoring', cat: 'SOFTWARE', amount: 890, vendor: 'Datadog Inc.' },
  { title: 'Notion Team Workspace', cat: 'SOFTWARE', amount: 360, vendor: 'Notion Labs' },
  { title: 'D&O Insurance Premium', cat: 'INSURANCE', amount: 4200, vendor: 'Hiscox' },
  { title: 'Anthropic API Credits', cat: 'SOFTWARE', amount: 1500, vendor: 'Anthropic' },
  { title: 'OpenAI API Usage', cat: 'SOFTWARE', amount: 2200, vendor: 'OpenAI' },
  { title: 'Contractor - UI/UX Design', cat: 'CONSULTING', amount: 4800, vendor: 'Freelancer' },
  { title: 'Business Internet - Fiber', cat: 'UTILITIES', amount: 189, vendor: 'AT&T Business' },
  { title: 'Ergonomic Standing Desks (x3)', cat: 'EQUIPMENT', amount: 2700, vendor: 'Uplift Desk' },
  { title: 'Tax Advisory Services', cat: 'TAXES', amount: 1800, vendor: 'KPMG' },
  { title: 'Customer Research Study', cat: 'RESEARCH', amount: 3500, vendor: 'UserTesting.com' },
];

// ─── Task Templates ─────────────────────────────────────────────────────────

const TASK_TEMPLATES = [
  { title: 'Implement multi-tenant data isolation', desc: 'Add row-level security policies for enterprise tenants', status: 'done', priority: 'high', labels: ['backend', 'security'], progress: 100 },
  { title: 'Design new pricing page', desc: 'Create Figma mockups for the updated pricing tiers with annual toggle', status: 'done', priority: 'medium', labels: ['design', 'frontend'], progress: 100 },
  { title: 'Set up Kafka dead-letter queue', desc: 'Configure DLQ for failed workflow events with retry logic', status: 'in-progress', priority: 'high', labels: ['backend', 'infrastructure'], progress: 65 },
  { title: 'Add Stripe webhook signature verification', desc: 'Verify webhook signatures to prevent replay attacks', status: 'done', priority: 'critical', labels: ['security', 'payments'], progress: 100 },
  { title: 'Build inventory low-stock alerts', desc: 'Push notifications when stock falls below reorder point', status: 'in-progress', priority: 'medium', labels: ['erp', 'notifications'], progress: 40 },
  { title: 'Migrate to Prisma 6', desc: 'Upgrade Prisma ORM to v6 with new preview features', status: 'done', priority: 'medium', labels: ['backend', 'dependencies'], progress: 100 },
  { title: 'Write E2E tests for order lifecycle', desc: 'Playwright tests covering DRAFT → DELIVERED flow', status: 'todo', priority: 'medium', labels: ['testing', 'erp'], progress: 0 },
  { title: 'Optimize dashboard initial load', desc: 'Reduce bundle size and add code splitting for ERP modules', status: 'in-progress', priority: 'high', labels: ['frontend', 'performance'], progress: 30 },
  { title: 'Add LINE channel integration', desc: 'Connect LINE Messaging API for Thai market customers', status: 'todo', priority: 'medium', labels: ['channels', 'integration'], progress: 0 },
  { title: 'Implement RBAC for ERP modules', desc: 'Role-based access control per module (CRM, inventory, invoicing)', status: 'in-progress', priority: 'high', labels: ['security', 'erp'], progress: 55 },
  { title: 'Create API rate limiting dashboard', desc: 'Visualize rate limit usage per endpoint in admin panel', status: 'todo', priority: 'low', labels: ['admin', 'monitoring'], progress: 0 },
  { title: 'Set up automated DB backups', desc: 'Daily pg_dump to S3 with 30-day retention', status: 'done', priority: 'critical', labels: ['infrastructure', 'database'], progress: 100 },
  { title: 'Build agent performance metrics', desc: 'Track response time, accuracy, and user satisfaction per agent', status: 'todo', priority: 'medium', labels: ['ai', 'analytics'], progress: 0 },
  { title: 'Add PDF export for invoices', desc: 'Generate branded PDF invoices with company logo and terms', status: 'in-progress', priority: 'medium', labels: ['erp', 'feature'], progress: 70 },
  { title: 'Fix timezone handling in reports', desc: 'Reports show UTC instead of user timezone for daily aggregations', status: 'in-progress', priority: 'high', labels: ['bug', 'erp'], progress: 20 },
  { title: 'Implement SSO with Okta', desc: 'SAML 2.0 integration for enterprise SSO via Okta', status: 'todo', priority: 'high', labels: ['enterprise', 'auth'], progress: 0 },
  { title: 'Add bulk import for contacts', desc: 'CSV/Excel import with field mapping and duplicate detection', status: 'todo', priority: 'medium', labels: ['erp', 'feature'], progress: 0 },
  { title: 'Upgrade Next.js to 15', desc: 'Migrate dashboard to Next.js 15 with React 19 support', status: 'todo', priority: 'low', labels: ['frontend', 'dependencies'], progress: 0 },
];

// ─── Chat History Templates ─────────────────────────────────────────────────

const CHAT_SESSIONS = [
  {
    agentId: 'sales-agent', agentName: 'Sales Assistant',
    summary: 'Helped customer understand Pro vs Enterprise pricing',
    channel: 'web',
    messages: [
      { author: 'Customer', text: 'Hi, I\'m looking at your pricing. What\'s the difference between Pro and Enterprise?' },
      { author: 'Sales Assistant', text: 'Great question! The Pro plan ($199/mo) includes up to 25 users with all Pro features like white-labeling, SSO, and advanced workflows. Enterprise ($799/mo) adds unlimited users, multi-tenancy, dedicated support with 1-hour SLA, and compliance features. Which aspects are most important for your team?' },
      { author: 'Customer', text: 'We have about 40 users and need SOC2 compliance. Sounds like Enterprise?' },
      { author: 'Sales Assistant', text: 'Exactly right. With 40 users you\'d exceed the Pro limit, and our Enterprise tier includes SOC2 compliance reports, audit logging, and data isolation. I can set up a demo with our solutions team if you\'d like to see it in action.' },
      { author: 'Customer', text: 'Yes please, that would be great. Can you do Thursday at 2pm PST?' },
      { author: 'Sales Assistant', text: 'Done! I\'ve scheduled a demo for Thursday at 2pm PST with our solutions engineer Sarah. You\'ll receive a calendar invite shortly. Is there anything specific you\'d like us to prepare for the demo?' },
    ],
  },
  {
    agentId: 'support-agent', agentName: 'Technical Support',
    summary: 'Resolved API rate limiting issue for customer integration',
    channel: 'web',
    messages: [
      { author: 'Developer', text: 'I\'m getting 429 errors when calling the /api/proxy/erp/contacts endpoint. My script needs to sync about 500 contacts.' },
      { author: 'Technical Support', text: 'The default rate limit is 30 requests/second for API endpoints. For bulk operations, I\'d recommend using the batch endpoint at POST /api/proxy/erp/contacts/bulk which accepts up to 100 records per request. That way you can sync 500 contacts in just 5 API calls.' },
      { author: 'Developer', text: 'Oh nice, didn\'t know about the bulk endpoint. What\'s the payload format?' },
      { author: 'Technical Support', text: 'Send a JSON array of contact objects: `{ "contacts": [{ "firstName": "...", "lastName": "...", "email": "...", "type": "CUSTOMER" }] }`. Each contact follows the same schema as the single-create endpoint. I can share a code sample if you\'re using Node.js or Python.' },
      { author: 'Developer', text: 'Node.js would be perfect, thanks!' },
    ],
  },
  {
    agentId: 'crm-agent', agentName: 'CRM Advisor',
    summary: 'Analyzed lead pipeline and recommended follow-up priorities',
    channel: 'web',
    messages: [
      { author: 'Sales Rep', text: 'Can you analyze our current lead pipeline and tell me which leads I should focus on this week?' },
      { author: 'CRM Advisor', text: 'Looking at your pipeline, you have 8 leads in the QUALIFIED stage and 3 in PROPOSAL. Here are my top priorities:\n\n1. **TechVista Solutions** (Score: 85) - Proposal sent 5 days ago, no response. Schedule a follow-up call.\n2. **CloudForge Systems** (Score: 78) - Qualified last week, requested a demo. Book it ASAP.\n3. **Pinnacle Finance** (Score: 72) - Downloaded whitepaper + attended webinar. High intent signals.\n\nThese three have the highest conversion probability based on engagement patterns.' },
      { author: 'Sales Rep', text: 'Good analysis. What about the Stellar Robotics lead?' },
      { author: 'CRM Advisor', text: 'Stellar Robotics (Score: 45) is still in early stages - they\'ve only visited the pricing page once and haven\'t engaged with content. I\'d recommend a nurture sequence rather than direct outreach. Add them to the "Tech Companies" email drip campaign and revisit in 2 weeks when they\'ve had more touchpoints.' },
    ],
  },
  {
    agentId: 'finance-agent', agentName: 'Finance Advisor',
    summary: 'Reviewed monthly P&L and flagged rising infrastructure costs',
    channel: 'web',
    messages: [
      { author: 'CFO', text: 'Give me a quick summary of our financial health this month.' },
      { author: 'Finance Advisor', text: 'Here\'s your March snapshot:\n\n**Revenue:** $47,200 (+12% MoM)\n- Software licenses: $38,400\n- Professional services: $8,800\n\n**Expenses:** $28,950\n- Infrastructure (AWS/Cloudflare): $6,680 (+18% - flagged)\n- Payroll: $15,200\n- Software tools: $4,870\n- Other: $2,200\n\n**Net Profit:** $18,250 (38.7% margin)\n\nThe infrastructure cost increase is notable - driven by increased AI compute usage. Consider reserved instances or commitment plans.' },
      { author: 'CFO', text: 'The AI compute costs concern me. What are our options?' },
      { author: 'Finance Advisor', text: 'Three options to optimize:\n1. **AWS Savings Plans** - Commit to 1yr compute for ~30% savings (~$2K/yr saved)\n2. **Model optimization** - Switch lower-priority tasks from GPT-4 to GPT-4-mini (est. 40% cost reduction on those calls)\n3. **Caching layer** - Cache frequent RAG queries to reduce redundant API calls\n\nOption 2 has the highest impact with zero upfront commitment. I\'d recommend starting there.' },
    ],
  },
  {
    agentId: 'hr-agent', agentName: 'HR Assistant',
    summary: 'Processed onboarding checklist for new hire',
    channel: 'web',
    messages: [
      { author: 'HR Manager', text: 'We have a new developer starting next Monday. Can you prepare the onboarding checklist?' },
      { author: 'HR Assistant', text: 'Onboarding checklist prepared for the new hire:\n\n**Before Day 1:**\n- [ ] Laptop ordered and configured\n- [ ] Google Workspace account created\n- [ ] GitHub org invite sent\n- [ ] Slack workspace invite sent\n- [ ] Welcome email drafted\n\n**Day 1:**\n- [ ] Office tour / virtual intro\n- [ ] Team introductions\n- [ ] Dev environment setup session\n- [ ] Security training\n- [ ] Access provisioned: Linear, Figma, Vercel\n\n**Week 1:**\n- [ ] Buddy assigned\n- [ ] First PR submitted\n- [ ] 1:1 with manager scheduled\n\nShall I create tasks for each item?' },
      { author: 'HR Manager', text: 'Yes, please create tasks and assign the IT items to Kevin.' },
    ],
  },
  {
    agentId: 'inventory-agent', agentName: 'Inventory Manager',
    summary: 'Alerted about low edge device stock and suggested reorder',
    channel: 'web',
    messages: [
      { author: 'Ops Manager', text: 'Do we have any stock alerts I should know about?' },
      { author: 'Inventory Manager', text: 'Yes, 2 items need attention:\n\n1. **UniCore Edge Device** (HW-EDGE-01): 3 units remaining, reorder point is 5. Lead time is 4 weeks from supplier.\n2. **Smart Dashboard Display** (HW-DISPLAY): 7 units, reorder point is 10.\n\nI\'d recommend placing the edge device order immediately given the long lead time. We have 2 pending customer orders that will consume the remaining stock.' },
      { author: 'Ops Manager', text: 'Place an order for 20 edge devices and 15 displays.' },
      { author: 'Inventory Manager', text: 'Purchase order drafted:\n- 20x UniCore Edge Device @ $1,800 = $36,000\n- 15x Smart Dashboard Display @ $450 = $6,750\n- **Total: $42,750**\n\nEstimated delivery: April 18. Shall I submit this to procurement for approval?' },
    ],
  },
];

// ─── Notification Templates ─────────────────────────────────────────────────

const NOTIFICATIONS = [
  { type: 'success', title: 'New order received', message: 'Order #ORD-0042 from TechVista Solutions for $2,595.00 has been confirmed.', link: '/erp/orders' },
  { type: 'warning', title: 'Low stock alert', message: 'UniCore Edge Device (HW-EDGE-01) is below reorder point. Only 3 units remaining.', link: '/erp/inventory' },
  { type: 'info', title: 'Invoice paid', message: 'Invoice #INV-0018 from CloudForge Systems has been fully paid ($799.00).', link: '/erp/invoicing' },
  { type: 'error', title: 'Payment failed', message: 'Stripe payment for Invoice #INV-0023 was declined. Card ending in 4242.', link: '/erp/invoicing' },
  { type: 'success', title: 'New lead captured', message: 'Priya Patel from Stellar Robotics signed up via the pricing page.', link: '/erp/contacts' },
  { type: 'info', title: 'Expense approved', message: 'Your expense "AWS Infrastructure - March" ($4,280.00) has been approved.', link: '/erp/expenses' },
  { type: 'warning', title: 'Invoice overdue', message: 'Invoice #INV-0011 for GreenLeaf Organics is 15 days overdue ($398.00).', link: '/erp/invoicing' },
  { type: 'success', title: 'Agent deployed', message: 'CRM Advisor agent has been deployed and is handling customer queries.', link: '/agents' },
  { type: 'info', title: 'Backup completed', message: 'Daily database backup completed successfully. Snapshot stored in S3.', link: '/admin/health' },
  { type: 'warning', title: 'Rate limit threshold', message: 'API endpoint /api/proxy/erp/contacts reached 80% of rate limit capacity.', link: '/admin/health' },
  { type: 'success', title: 'Workflow completed', message: 'Order fulfillment workflow for ORD-0038 completed. Customer notified.', link: '/erp/orders' },
  { type: 'info', title: 'New team member', message: 'Daniel Park (DevOps Lead) has joined the workspace as OPERATOR.', link: '/admin/users' },
];

// ─── Seeding Functions ───────────────────────────────────────────────────────

async function seedContacts(): Promise<{ id: string; name: string; type: string }[]> {
  console.log('\n📇 Seeding contacts...');
  const contacts: { id: string; name: string; type: string }[] = [];

  // Check for existing contacts first
  const existing = await api('GET', `${ERP}/contacts?limit=100`);
  if (existing?.data?.length >= PEOPLE.length) {
    console.log(`  ℹ Found ${existing.data.length} existing contacts, using those`);
    for (const c of existing.data) {
      contacts.push({ id: c.id, name: c.name, type: c.type });
    }
    return contacts;
  }

  const types = ['CUSTOMER', 'CUSTOMER', 'CUSTOMER', 'LEAD', 'LEAD', 'LEAD', 'PROSPECT', 'PROSPECT', 'VENDOR', 'PARTNER'];
  const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
  const sources = ['Website', 'Referral', 'LinkedIn', 'Conference', 'Cold Outreach', 'Webinar', 'Product Hunt', 'Google Ads'];
  const tags = ['enterprise', 'startup', 'mid-market', 'high-value', 'pilot', 'renewal', 'upsell', 'inbound', 'outbound', 'partner-referred'];

  for (let i = 0; i < PEOPLE.length; i++) {
    const person = PEOPLE[i];
    const company = COMPANIES[i % COMPANIES.length];
    const type = types[i % types.length];
    const country = pick(COUNTRIES);
    const city = pick(CITIES[country]);
    const contactTags = [pick(tags), pick(tags)].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const data: any = {
      type,
      firstName: person.first,
      lastName: person.last,
      email: `${person.first.toLowerCase()}.${person.last.toLowerCase()}@${company.domain}`,
      phone: `+1-${rand(200, 999)}-${rand(100, 999)}-${rand(1000, 9999)}`,
      company: company.name,
      website: `https://${company.domain}`,
      country,
      city,
      currency: 'USD',
      tags: contactTags,
      notes: `${person.role} at ${company.name} (${company.industry}). ${pick(sources)} lead.`,
    };

    if (type === 'LEAD' || type === 'PROSPECT') {
      data.leadScore = rand(20, 95);
    } else if (type === 'CUSTOMER') {
      data.leadScore = rand(70, 100);
    } else {
      data.leadScore = rand(0, 50);
    }

    const res = await api('POST', `${ERP}/contacts`, data);
    if (res) {
      contacts.push({ id: res.id, name: `${person.first} ${person.last}`, type });
      console.log(`  ✓ ${type.padEnd(10)} ${person.first} ${person.last} (${company.name})`);
    }
  }

  return contacts;
}

async function seedProducts(): Promise<{ id: string; sku: string; name: string; price: number }[]> {
  console.log('\n📦 Seeding products...');
  const products: { id: string; sku: string; name: string; price: number }[] = [];

  // Check for existing products first
  const existing = await api('GET', `${ERP}/inventory?limit=100`);
  if (existing?.data?.length > 0) {
    console.log(`  ℹ Found ${existing.data.length} existing products, using those`);
    for (const p of existing.data) {
      products.push({ id: p.id, sku: p.sku, name: p.name, price: parseFloat(p.unitPrice || '0') });
    }
    if (products.length >= PRODUCTS.length) return products;
  }

  for (const p of PRODUCTS) {
    // Skip if already exists
    if (products.find(ep => ep.sku === p.sku)) continue;

    const quantity = p.type === 'digital' ? rand(500, 9999) : rand(5, 100);
    const data = {
      sku: p.sku,
      name: p.name,
      description: p.desc,
      category: p.cat,
      unitPrice: p.price,
      costPrice: p.cost,
      quantity,
      lowStockThreshold: p.type === 'physical' ? rand(5, 15) : 50,
      tags: [p.cat.toLowerCase().replace(/ /g, '-'), p.type],
    };

    const res = await api('POST', `${ERP}/inventory`, data);
    if (res) {
      products.push({ id: res.id, sku: p.sku, name: p.name, price: p.price });
      console.log(`  ✓ ${p.sku.padEnd(18)} ${p.name} ($${p.price})`);
    }
  }

  return products;
}

async function seedOrders(
  contacts: { id: string; name: string; type: string }[],
  products: { id: string; sku: string; name: string; price: number }[],
): Promise<{ id: string; orderNumber: string; contactId: string; total: number }[]> {
  console.log('\n🛒 Seeding orders...');
  const orders: { id: string; orderNumber: string; contactId: string; total: number }[] = [];

  // Check existing
  const existingOrders = await api('GET', `${ERP}/orders?limit=100`);
  if (existingOrders?.data?.length >= 10) {
    console.log(`  ℹ Found ${existingOrders.data.length} existing orders, skipping`);
    for (const o of existingOrders.data) {
      orders.push({ id: o.id, orderNumber: o.orderNumber, contactId: o.contactId, total: parseFloat(o.total || '0') });
    }
    return orders;
  }

  const customers = contacts.filter(c => c.type === 'CUSTOMER' || c.type === 'PROSPECT');

  // Create diverse orders with different statuses
  const orderScenarios = [
    { status: 'confirmed', count: 5 },
    { status: 'processing', count: 3 },
    { status: 'shipped', count: 4 },
    { status: 'fulfilled', count: 6 },
    { status: 'draft', count: 3 },
    { status: 'cancelled', count: 2 },
  ];

  for (const scenario of orderScenarios) {
    for (let i = 0; i < scenario.count; i++) {
      const contact = pick(customers);
      const numItems = rand(1, 4);
      const lineItems = [];
      const usedProducts = new Set<string>();

      for (let j = 0; j < numItems; j++) {
        let product;
        do {
          product = pick(products);
        } while (usedProducts.has(product.id));
        usedProducts.add(product.id);

        lineItems.push({
          productId: product.id,
          quantity: rand(1, 5),
          unitPrice: product.price,
        });
      }

      const data = {
        contactId: contact.id,
        lineItems,
        taxRate: 0.07,
        discount: rand(0, 1) > 0.7 ? rand(10, 100) : 0,
        currency: 'USD',
        notes: `Order for ${contact.name}`,
        shippingAddress: `${rand(100, 9999)} ${pick(['Main St', 'Oak Ave', 'Tech Blvd', 'Innovation Dr', 'Market St'])}`,
      };

      const res = await api('POST', `${ERP}/orders`, data);
      if (res) {
        orders.push({ id: res.id, orderNumber: res.orderNumber, contactId: contact.id, total: res.total || 0 });

        // Transition order to desired status
        if (scenario.status !== 'draft') {
          await api('POST', `${ERP}/orders/${res.id}/confirm`, {});
          if (scenario.status !== 'confirmed') {
            await api('POST', `${ERP}/orders/${res.id}/process`, {});
            if (scenario.status === 'shipped') {
              await api('POST', `${ERP}/orders/${res.id}/ship`, {
                trackingNumber: `TRK${rand(100000, 999999)}`,
                carrier: pick(['FedEx', 'UPS', 'DHL', 'USPS']),
              });
            } else if (scenario.status === 'fulfilled') {
              await api('POST', `${ERP}/orders/${res.id}/fulfill`, {
                trackingNumber: `TRK${rand(100000, 999999)}`,
                carrier: pick(['FedEx', 'UPS', 'DHL', 'USPS']),
                notes: 'Delivered and confirmed by customer',
              });
            } else if (scenario.status === 'cancelled') {
              await api('POST', `${ERP}/orders/${res.id}/cancel`, {
                reason: pick(['Customer requested cancellation', 'Out of stock', 'Duplicate order']),
              });
            }
          }
        }

        console.log(`  ✓ ${res.orderNumber?.padEnd(12) || 'ORDER'} ${scenario.status.padEnd(12)} ${contact.name}`);
      }
    }
  }

  return orders;
}

async function seedInvoices(
  contacts: { id: string; name: string; type: string }[],
  orders: { id: string; orderNumber: string; contactId: string; total: number }[],
) {
  console.log('\n🧾 Seeding invoices...');

  // Check existing
  const existingInv = await api('GET', `${ERP}/invoices?limit=100`);
  if (existingInv?.data?.length >= 10) {
    console.log(`  ℹ Found ${existingInv.data.length} existing invoices, skipping`);
    return;
  }

  const customers = contacts.filter(c => c.type === 'CUSTOMER');
  const paymentMethods = ['CREDIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'PAYPAL'];

  // Create invoices from orders
  for (let i = 0; i < Math.min(orders.length, 15); i++) {
    const order = orders[i];
    const contact = contacts.find(c => c.id === order.contactId) || pick(customers);
    const numLines = rand(1, 3);
    const lineItems = [];

    for (let j = 0; j < numLines; j++) {
      const product = pick(PRODUCTS);
      const qty = rand(1, 5);
      lineItems.push({
        description: product.name,
        quantity: qty,
        unitPrice: product.price,
      });
    }

    const dueDate = futureDate(rand(-15, 45));
    const data = {
      contactId: contact.id,
      orderId: order.id,
      lineItems,
      taxRate: 0.07,
      discount: rand(0, 1) > 0.8 ? rand(5, 50) : 0,
      currency: 'USD',
      dueDate,
      notes: `Invoice for order ${order.orderNumber}`,
    };

    const res = await api('POST', `${ERP}/invoices`, data);
    if (res) {
      // Vary invoice statuses
      const statusAction = pick(['send', 'send', 'send', 'pay', 'pay', 'pay', 'pay', 'partial', 'leave']);

      if (statusAction !== 'leave') {
        await api('POST', `${ERP}/invoices/${res.id}/send`, {});
      }

      const invoiceTotal = parseFloat(res.total || res.amountDue || '100');
      if (statusAction === 'pay' && invoiceTotal > 0) {
        await api('POST', `${ERP}/invoices/${res.id}/record-payment`, {
          amount: invoiceTotal,
          method: pick(paymentMethods),
          reference: `PAY-${rand(10000, 99999)}`,
          notes: 'Payment received',
        });
      } else if (statusAction === 'partial' && invoiceTotal > 0) {
        const partial = Math.round(invoiceTotal * 0.4 * 100) / 100;
        await api('POST', `${ERP}/invoices/${res.id}/record-payment`, {
          amount: partial,
          method: pick(paymentMethods),
          reference: `PAY-${rand(10000, 99999)}`,
          notes: 'Partial payment',
        });
      }

      console.log(`  ✓ ${res.invoiceNumber?.padEnd(12) || 'INV'} ${statusAction.padEnd(10)} ${contact.name}`);
    }
  }

  // Create standalone invoices (not tied to orders)
  for (let i = 0; i < 8; i++) {
    const contact = pick(customers);
    const product = pick(PRODUCTS);
    const lineItems = [
      { description: `${product.name} - Monthly subscription`, quantity: 1, unitPrice: product.price },
    ];

    if (rand(0, 1)) {
      const addon = pick(PRODUCTS.filter(p => p.cat === 'Add-on'));
      lineItems.push({ description: addon.name, quantity: rand(1, 3), unitPrice: addon.price });
    }

    const res = await api('POST', `${ERP}/invoices`, {
      contactId: contact.id,
      lineItems,
      taxRate: 0.07,
      currency: 'USD',
      dueDate: futureDate(rand(15, 60)),
      notes: 'Recurring subscription invoice',
    });

    if (res) {
      await api('POST', `${ERP}/invoices/${res.id}/send`, {});
      if (rand(0, 1)) {
        await api('POST', `${ERP}/invoices/${res.id}/record-payment`, {
          amount: res.total || res.amountDue || 100,
          method: 'STRIPE',
          reference: `ch_${rand(100000, 999999)}`,
        });
      }
      console.log(`  ✓ ${res.invoiceNumber?.padEnd(12) || 'INV'} standalone  ${contact.name}`);
    }
  }

  // Mark overdue invoices
  await api('POST', `${ERP}/invoices/mark-overdue`, {});
  console.log('  ✓ Marked overdue invoices');
}

async function seedExpenses(userId: string) {
  console.log('\n💰 Seeding expenses...');

  // Check existing
  const existingExp = await api('GET', `${ERP}/expenses?limit=100`);
  if (existingExp?.data?.length >= 10) {
    console.log(`  ℹ Found ${existingExp.data.length} existing expenses, skipping`);
    return;
  }

  for (const exp of EXPENSE_TEMPLATES) {
    const daysAgo = rand(1, 90);
    const data = {
      title: exp.title,
      description: `${exp.title} - ${exp.vendor}`,
      category: exp.cat,
      amount: exp.amount + randFloat(-exp.amount * 0.1, exp.amount * 0.1),
      currency: 'USD',
      paidAt: pastDate(daysAgo),
      submittedBy: userId,
      notes: `Vendor: ${exp.vendor}. Regular business expense.`,
      tags: [exp.cat.toLowerCase().replace(/_/g, '-')],
    };

    const res = await api('POST', `${ERP}/expenses`, data);
    if (res) {
      console.log(`  ✓ $${data.amount.toFixed(0).padStart(6)} ${exp.title.substring(0, 50)}`);
    }
  }
}

async function seedTasks(userId: string) {
  console.log('\n✅ Seeding tasks...');

  // Check existing
  const existingTasks = await api('GET', `${GATEWAY}/tasks`);
  const taskCount = existingTasks?.tasks?.length || existingTasks?.length || 0;
  if (taskCount >= 10) {
    console.log(`  ℹ Found ${taskCount} existing tasks, skipping`);
    return;
  }

  const assignees = [
    { name: 'Sarah Chen', type: 'human', color: '#3B82F6' },
    { name: 'Marcus Williams', type: 'human', color: '#10B981' },
    { name: 'CRM Advisor', type: 'agent', color: '#8B5CF6' },
    { name: 'Sales Assistant', type: 'agent', color: '#F59E0B' },
    { name: 'Emily Rodriguez', type: 'human', color: '#EF4444' },
    { name: 'Technical Support', type: 'agent', color: '#06B6D4' },
  ];

  for (const task of TASK_TEMPLATES) {
    const assignee = pick(assignees);
    const data = {
      title: task.title,
      description: task.desc,
      status: task.status,
      priority: task.priority,
      labels: task.labels,
      assigneeName: assignee.name,
      assigneeType: assignee.type,
      assigneeColor: assignee.color,
      creatorId: userId,
      creatorType: 'human',
      progress: task.progress,
    };

    const res = await api('POST', `${GATEWAY}/tasks`, data);
    if (res) {
      console.log(`  ✓ [${task.status.padEnd(12)}] ${task.title.substring(0, 55)}`);
    }
  }
}

async function seedChatHistory(userId: string) {
  console.log('\n💬 Seeding chat history...');

  // Check existing
  const existingChats = await api('GET', `${GATEWAY}/chat-history?limit=10`);
  const chatCount = existingChats?.data?.length || existingChats?.total || 0;
  if (chatCount >= 6) {
    console.log(`  ℹ Found ${chatCount} existing chat sessions, skipping`);
    return;
  }

  for (const chat of CHAT_SESSIONS) {
    const messages = chat.messages.map((m, i) => ({
      id: `msg-${Date.now()}-${i}`,
      text: m.text,
      author: m.author,
      authorId: m.author === chat.agentName ? chat.agentId : userId,
      authorType: m.author === chat.agentName ? 'agent' : 'human',
      timestamp: pastDate(rand(1, 30)),
    }));

    const data = {
      agentId: chat.agentId,
      agentName: chat.agentName,
      messages,
      summary: chat.summary,
      channel: chat.channel,
    };

    const res = await api('POST', `${GATEWAY}/chat-history`, data);
    if (res) {
      console.log(`  ✓ ${chat.agentName.padEnd(20)} "${chat.summary.substring(0, 50)}..."`);
    }
  }
}

async function updateExpenseStatuses(userId: string) {
  console.log('\n  Updating expense statuses via database...');
  const { execSync, spawnSync } = await import('child_process');
  const { writeFileSync, unlinkSync } = await import('fs');

  try {
    const sql = `
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") as rn
  FROM "Expense"
  WHERE status = 'DRAFT'
)
UPDATE "Expense" e SET
  status = CASE
    WHEN n.rn % 10 IN (0,1,2) THEN 'SUBMITTED'::"ExpenseStatus"
    WHEN n.rn % 10 IN (3,4,5,6) THEN 'APPROVED'::"ExpenseStatus"
    WHEN n.rn % 10 = 7 THEN 'REJECTED'::"ExpenseStatus"
    WHEN n.rn % 10 = 8 THEN 'REIMBURSED'::"ExpenseStatus"
    ELSE 'DRAFT'::"ExpenseStatus"
  END,
  "approvedById" = CASE
    WHEN n.rn % 10 IN (3,4,5,6,7,8) THEN '${userId}'::uuid
    ELSE NULL
  END,
  "approvedAt" = CASE
    WHEN n.rn % 10 IN (3,4,5,6,8) THEN NOW()
    ELSE NULL
  END
FROM numbered n
WHERE e.id = n.id;
`;
    writeFileSync('/tmp/seed-expenses.sql', sql);
    execSync('docker cp /tmp/seed-expenses.sql unicores-unicore-postgres-1:/tmp/seed-expenses.sql', { stdio: 'pipe' });
    execSync('docker exec unicores-unicore-postgres-1 psql -U unicore -d unicore_erp -f /tmp/seed-expenses.sql', { stdio: 'pipe' });
    unlinkSync('/tmp/seed-expenses.sql');
    console.log('  ✓ Expense statuses updated (SUBMITTED/APPROVED/REJECTED/REIMBURSED)');
  } catch (err: any) {
    console.log('  ℹ Could not update expense statuses:', err.stderr?.toString()?.substring(0, 200) || err.message?.substring(0, 200));
  }
}

async function seedNotificationsViaSql(userId: string) {
  console.log('\n🔔 Seeding notifications via database...');
  const { execSync } = await import('child_process');
  const { writeFileSync, unlinkSync } = await import('fs');

  const values = NOTIFICATIONS.map((n) => {
    const id = `notif_${Math.random().toString(36).substring(2, 15)}`;
    const read = Math.random() > 0.6 ? 'true' : 'false';
    const ago = rand(0, 14);
    const escaped = (s: string) => s.replace(/'/g, "''");
    return `('${id}', '${userId}', '${n.type}', '${escaped(n.title)}', '${escaped(n.message)}', ${read}, '${n.link || ''}', NOW() - interval '${ago} days', NOW() - interval '${ago} days')`;
  }).join(',\n');

  const sql = `INSERT INTO notifications (id, "userId", type, title, message, read, link, "createdAt", "updatedAt") VALUES
${values}
ON CONFLICT DO NOTHING;`;

  try {
    writeFileSync('/tmp/seed-notifications.sql', sql);
    execSync('docker cp /tmp/seed-notifications.sql unicores-unicore-postgres-1:/tmp/seed-notifications.sql', { stdio: 'pipe' });
    execSync('docker exec unicores-unicore-postgres-1 psql -U unicore -d unicore -f /tmp/seed-notifications.sql', { stdio: 'pipe' });
    unlinkSync('/tmp/seed-notifications.sql');
    for (const n of NOTIFICATIONS) {
      console.log(`  ✓ [${n.type.padEnd(8)}] ${n.title}`);
    }
  } catch (err: any) {
    console.log('  ℹ Could not seed notifications:', err.stderr?.toString()?.substring(0, 200) || err.message?.substring(0, 200));
  }
}

async function seedAuditLogs() {
  console.log('\n📋 Seeding audit logs...');
  // Audit logs are typically auto-generated by actions, so the seeding
  // above (creating contacts, orders, etc.) should have generated them.
  // We verify they exist.
  const logs = await api('GET', `${GATEWAY}/admin/audit-logs?limit=5`);
  if (logs?.data?.length > 0) {
    console.log(`  ✓ ${logs.total || logs.data.length} audit log entries exist`);
  } else {
    console.log('  ℹ Audit logs will populate as users interact with the system');
  }
}

async function seedAdditionalUsers() {
  console.log('\n👥 Seeding team members...');

  const teamMembers = [
    { email: 'sarah.chen@unicore.dev', password: 'Demo1234!', name: 'Sarah Chen', role: 'OPERATOR' },
    { email: 'marcus.williams@unicore.dev', password: 'Demo1234!', name: 'Marcus Williams', role: 'OPERATOR' },
    { email: 'emily.rodriguez@unicore.dev', password: 'Demo1234!', name: 'Emily Rodriguez', role: 'MARKETER' },
    { email: 'laura.martinez@unicore.dev', password: 'Demo1234!', name: 'Laura Martinez', role: 'FINANCE' },
    { email: 'viewer@unicore.dev', password: 'Demo1234!', name: 'Demo Viewer', role: 'VIEWER' },
  ];

  for (const user of teamMembers) {
    // Register user (requires confirmPassword)
    const res = await api('POST', `${API}/auth/register`, {
      email: user.email,
      password: user.password,
      confirmPassword: user.password,
      name: user.name,
    });

    if (res) {
      // Update role via admin endpoint
      if (user.role !== 'VIEWER') {
        await api('PATCH', `${GATEWAY}/admin/users/${res.id || res.user?.id}/role`, {
          role: user.role,
        });
      }
      console.log(`  ✓ ${user.role.padEnd(10)} ${user.name} (${user.email})`);
    } else {
      console.log(`  ℹ ${user.name} may already exist`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           UniCore Demo Data Seeder v1.0                 ║');
  console.log('║  Populating all tables with realistic business data     ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  API: ${API.padEnd(49)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  // 1. Login
  await login();

  // Get current user ID
  const me = await api('GET', `${GATEWAY}/admin/users`);
  const adminUser = me?.data?.find((u: any) => u.email === 'admin@unicore.dev') || me?.[0];
  const userId = adminUser?.id || 'admin';

  // 2. Seed team members
  await seedAdditionalUsers();

  // 3. Seed products first (needed for orders)
  const products = await seedProducts();

  // 4. Seed contacts
  const contacts = await seedContacts();

  // 5. Seed orders (needs contacts + products)
  const orders = await seedOrders(contacts, products);

  // 6. Seed invoices (needs contacts + orders)
  await seedInvoices(contacts, orders);

  // 7. Seed expenses
  await seedExpenses(userId);
  await updateExpenseStatuses(userId);

  // 8. Seed tasks
  await seedTasks(userId);

  // 9. Seed chat history
  await seedChatHistory(userId);

  // 10. Seed notifications via database
  await seedNotificationsViaSql(userId);

  // 11. Verify audit logs
  await seedAuditLogs();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    Seeding Complete!                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Contacts:       ${contacts.length.toString().padEnd(4)} records                           ║`);
  console.log(`║  Products:       ${products.length.toString().padEnd(4)} records                           ║`);
  console.log(`║  Orders:         ${orders.length.toString().padEnd(4)} records (mixed statuses)            ║`);
  console.log(`║  Invoices:       ~23  records (paid/partial/overdue)    ║`);
  console.log(`║  Expenses:       ${EXPENSE_TEMPLATES.length.toString().padEnd(4)} records (approved/rejected)        ║`);
  console.log(`║  Tasks:          ${TASK_TEMPLATES.length.toString().padEnd(4)} records (todo/progress/done)        ║`);
  console.log(`║  Chat Sessions:  ${CHAT_SESSIONS.length.toString().padEnd(4)} conversations                      ║`);
  console.log(`║  Notifications:  ${NOTIFICATIONS.length.toString().padEnd(4)} alerts                              ║`);
  console.log(`║  Team Members:   5    users (various roles)             ║`);
  console.log(`║  Time:           ${elapsed.padEnd(4)}s                                  ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Dashboard: https://unicore-demo.bemind.tech            ║');
  console.log('║  Login:     admin@unicore.dev / admin123                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\n❌ Seeder failed:', err.message);
  process.exit(1);
});
