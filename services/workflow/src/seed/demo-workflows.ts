/**
 * Demo workflow definitions for development seeding.
 *
 * Usage:
 *   NODE_ENV=development npx ts-node -r tsconfig-paths/register src/seed/demo-workflows.ts
 *
 * Or set SEED_DEMO_WORKFLOWS=true to auto-seed on startup in development mode.
 *
 * These workflows are NOT loaded in production. They exist solely to give
 * developers a realistic starting point when running UniCore locally.
 */

export interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface WorkflowTrigger {
  type: string;
  event?: string;
  cron?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schemaVersion: number;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

export const DEMO_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'wf-order-fulfillment',
    name: 'Order Fulfillment Pipeline',
    description:
      'Automatically notify warehouse, update inventory, and email customer when order is confirmed',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'erp.order.created' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'inventory-agent',
          promptTemplate:
            'Check stock availability for order {{payload.orderNumber}} with items: {{payload.items}}',
        },
      },
      {
        id: 'a2',
        type: 'send_notification',
        config: {
          channel: 'slack',
          recipient: '#warehouse',
          subject: 'New Order',
          bodyTemplate:
            'Order {{payload.orderNumber}} received — {{payload.total}} {{payload.currency}}',
        },
      },
      {
        id: 'a3',
        type: 'update_erp',
        config: {
          entity: 'order',
          entityId: '{{payload.orderId}}',
          fields: { fulfillmentStatus: 'PICKING' },
        },
      },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-18T14:30:00Z',
  },
  {
    id: 'wf-low-stock-alert',
    name: 'Low Stock Auto-Reorder',
    description:
      'When inventory drops below reorder point, create purchase order and notify procurement team',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'erp.inventory.low' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'procurement-agent',
          promptTemplate:
            'Generate purchase order for {{payload.productName}} (SKU: {{payload.sku}}). Current stock: {{payload.currentQty}}, reorder qty: {{payload.reorderQty}}',
        },
      },
      {
        id: 'a2',
        type: 'send_telegram',
        config: {
          chatId: '-1001234567890',
          message:
            '⚠️ Low stock: {{payload.productName}} — only {{payload.currentQty}} units left. PO created automatically.',
        },
      },
    ],
    createdAt: '2026-03-08T11:00:00Z',
    updatedAt: '2026-03-15T16:45:00Z',
  },
  {
    id: 'wf-invoice-overdue',
    name: 'Overdue Invoice Follow-up',
    description:
      'Send payment reminder emails and escalate to finance team when invoices become overdue',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'erp.invoice.overdue' },
    actions: [
      {
        id: 'a1',
        type: 'send_notification',
        config: {
          channel: 'email',
          recipient: '{{payload.contactEmail}}',
          subject: 'Payment Reminder: Invoice {{payload.invoiceNumber}}',
          bodyTemplate:
            'Dear {{payload.contactName}},\n\nInvoice {{payload.invoiceNumber}} for {{payload.total}} {{payload.currency}} is now overdue. Please arrange payment at your earliest convenience.\n\nThank you.',
        },
      },
      {
        id: 'a2',
        type: 'send_notification',
        config: {
          channel: 'slack',
          recipient: '#finance',
          subject: 'Overdue Invoice Alert',
          bodyTemplate:
            '🔴 Invoice {{payload.invoiceNumber}} ({{payload.total}} {{payload.currency}}) for {{payload.contactName}} is overdue by {{payload.daysOverdue}} days.',
        },
      },
    ],
    createdAt: '2026-03-05T08:00:00Z',
    updatedAt: '2026-03-19T10:20:00Z',
  },
  {
    id: 'wf-new-lead-nurture',
    name: 'New Lead Nurture Sequence',
    description:
      'When a new lead is captured, score them with AI and start automated nurture campaign',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'event', event: 'crm.lead.created' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'crm-agent',
          promptTemplate:
            'Analyze lead {{payload.contactName}} from {{payload.company}}. Source: {{payload.source}}. Assign a lead score (0-100) and recommend next action.',
        },
      },
      {
        id: 'a2',
        type: 'update_erp',
        config: {
          entity: 'contact',
          entityId: '{{payload.contactId}}',
          fields: { leadStage: 'CONTACTED' },
        },
      },
      {
        id: 'a3',
        type: 'send_notification',
        config: {
          channel: 'email',
          recipient: '{{payload.contactEmail}}',
          subject: 'Welcome to UniCore!',
          bodyTemplate:
            'Hi {{payload.contactName}},\n\nThank you for your interest in UniCore! Here are some resources to get you started...',
        },
      },
    ],
    createdAt: '2026-03-12T13:00:00Z',
    updatedAt: '2026-03-20T09:15:00Z',
  },
  {
    id: 'wf-daily-report',
    name: 'Daily Business Summary',
    description:
      'Generate and send daily P&L summary, top orders, and key metrics every morning at 9 AM',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'schedule.cron', cron: '0 9 * * *' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'finance-agent',
          promptTemplate:
            'Generate a daily business summary including: revenue, expenses, new orders, new leads, and any alerts for today.',
        },
      },
      {
        id: 'a2',
        type: 'send_telegram',
        config: {
          chatId: '-1009876543210',
          message: '📊 Daily Report\n\n{{steps.a1.output}}',
          parseMode: 'HTML',
        },
      },
    ],
    createdAt: '2026-03-01T07:00:00Z',
    updatedAt: '2026-03-17T11:30:00Z',
  },
  {
    id: 'wf-payment-received',
    name: 'Payment Confirmation Flow',
    description:
      'When invoice is paid, update order status, send receipt, and log to accounting channel',
    enabled: false,
    schemaVersion: 1,
    trigger: { type: 'erp.invoice.paid' },
    actions: [
      {
        id: 'a1',
        type: 'send_notification',
        config: {
          channel: 'email',
          recipient: '{{payload.contactEmail}}',
          subject: 'Payment Received — {{payload.invoiceNumber}}',
          bodyTemplate:
            'Thank you for your payment of {{payload.total}} {{payload.currency}}. Your invoice {{payload.invoiceNumber}} has been marked as paid.',
        },
      },
      {
        id: 'a2',
        type: 'send_notification',
        config: {
          channel: 'slack',
          recipient: '#accounting',
          subject: 'Payment Received',
          bodyTemplate:
            '💰 Payment received: {{payload.invoiceNumber}} — {{payload.total}} {{payload.currency}} from {{payload.contactName}}',
        },
      },
    ],
    createdAt: '2026-03-14T15:00:00Z',
    updatedAt: '2026-03-14T15:00:00Z',
  },
  {
    id: 'wf-customer-onboarding',
    name: 'Customer Onboarding Automation',
    description: 'Trigger onboarding sequence when a contact is converted from LEAD to CUSTOMER',
    enabled: false,
    schemaVersion: 1,
    trigger: { type: 'event', event: 'crm.contact.converted' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'sales-agent',
          promptTemplate:
            'Create onboarding plan for new customer {{payload.contactName}} ({{payload.company}}). Include: welcome email, demo scheduling, and documentation links.',
        },
      },
      {
        id: 'a2',
        type: 'send_line',
        config: {
          to: '{{payload.lineUserId}}',
          message: 'Welcome aboard, {{payload.contactName}}! 🎉 Your UniCore account is ready.',
        },
      },
    ],
    createdAt: '2026-03-16T10:00:00Z',
    updatedAt: '2026-03-16T10:00:00Z',
  },
  {
    id: 'wf-manual-data-sync',
    name: 'Manual Data Sync to External CRM',
    description: 'Manually triggered workflow to sync contacts and orders to external CRM system',
    enabled: true,
    schemaVersion: 1,
    trigger: { type: 'manual' },
    actions: [
      {
        id: 'a1',
        type: 'call_agent',
        config: {
          agentName: 'ops-agent',
          promptTemplate:
            'Export all contacts updated in the last 24 hours and sync to external CRM via API.',
        },
      },
      {
        id: 'a2',
        type: 'send_notification',
        config: {
          channel: 'slack',
          recipient: '#ops',
          subject: 'Data Sync Complete',
          bodyTemplate: 'CRM sync completed: {{steps.a1.output}}',
        },
      },
    ],
    createdAt: '2026-03-18T08:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Seed runner — only executes in development or when SEED_DEMO_WORKFLOWS=true
// ---------------------------------------------------------------------------

async function seed() {
  const isDev = process.env.NODE_ENV !== 'production';
  const explicitSeed = process.env.SEED_DEMO_WORKFLOWS === 'true';

  if (!isDev && !explicitSeed) {
    console.log('[seed] Skipping demo workflow seed (production mode). Set SEED_DEMO_WORKFLOWS=true to override.');
    return;
  }

  // Lazy-import the workflow loader/registry to avoid coupling at module level
  const loaderPath = '../loader';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WorkflowLoaderService } = require(loaderPath) as {
      WorkflowLoaderService: { prototype: { upsert: (def: WorkflowDefinition) => Promise<void> } };
    };

    // When run standalone the service won't be available — just print the definitions
    void WorkflowLoaderService;
    console.log('[seed] WorkflowLoaderService found — upsert via service not implemented in standalone mode.');
  } catch {
    // Standalone mode: print definitions as JSON so they can be piped to the API
    console.log('[seed] Running in standalone mode. Outputting definitions as JSON:');
    console.log(JSON.stringify(DEMO_WORKFLOWS, null, 2));
  }
}

// Run when executed directly (not imported as a module)
if (require.main === module) {
  seed().catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
  });
}
