/**
 * Plugin Registry Seed Script
 * Populates Plugin + PluginVersion tables with the official UniCore plugin catalogue.
 *
 * Usage (CLI):
 *   npx ts-node -r tsconfig-paths/register src/plugins/seed-plugins.ts
 *
 * Usage (programmatic):
 *   import { seedPlugins } from './seed-plugins';
 *   await seedPlugins(prisma);
 */

import { Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

// ---------------------------------------------------------------------------
// Catalogue definition
// ---------------------------------------------------------------------------

export interface PluginSeedEntry {
  name: string;
  slug: string;
  type: 'ai' | 'integration' | 'workflow' | 'ui' | 'utility';
  author: string;
  description: string;
  icon: string;
  downloads: number;
  rating: number;
  versions: PluginVersionSeedEntry[];
}

export interface PluginVersionSeedEntry {
  semver: string;
  changelog: string;
  artifactUrl: string;
  checksum: string;
  compatibility: {
    minApiVersion?: string;
    maxApiVersion?: string;
    nodeVersion?: string;
  };
}

export const PLUGIN_CATALOGUE: PluginSeedEntry[] = [
  // ── AI ──────────────────────────────────────────────────────────────────
  {
    name: 'GPT-4o Agent',
    slug: 'gpt4o-agent',
    type: 'ai',
    author: 'UniCore Labs',
    description:
      'Connects OpenAI GPT-4o to the UniCore agent pipeline. Supports streaming, function-calling, vision, and JSON-mode responses.',
    icon: 'openai',
    downloads: 14820,
    rating: 4.9,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Initial release with GPT-4o chat completion support.',
        artifactUrl: 'https://registry.unicore.dev/plugins/gpt4o-agent/1.0.0.tgz',
        checksum: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
      {
        semver: '1.1.0',
        changelog: 'Added streaming support and vision (image input) capabilities.',
        artifactUrl: 'https://registry.unicore.dev/plugins/gpt4o-agent/1.1.0.tgz',
        checksum: 'sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
      {
        semver: '1.2.0',
        changelog: 'JSON-mode output, parallel function-calling, improved token estimation.',
        artifactUrl: 'https://registry.unicore.dev/plugins/gpt4o-agent/1.2.0.tgz',
        checksum: 'sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        compatibility: { minApiVersion: '1.1.0', nodeVersion: '>=20' },
      },
    ],
  },
  {
    name: 'LangChain Toolkit',
    slug: 'langchain-toolkit',
    type: 'ai',
    author: 'UniCore Labs',
    description:
      'Integrates LangChain.js chains and tools into the UniCore workflow engine. Supports LCEL pipelines, memory, and tool-use.',
    icon: 'langchain',
    downloads: 8340,
    rating: 4.7,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Initial support for LangChain LCEL pipelines and basic memory.',
        artifactUrl: 'https://registry.unicore.dev/plugins/langchain-toolkit/1.0.0.tgz',
        checksum: 'sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
      {
        semver: '1.1.0',
        changelog: 'Added ConversationBufferWindowMemory, VectorStoreRetriever integration.',
        artifactUrl: 'https://registry.unicore.dev/plugins/langchain-toolkit/1.1.0.tgz',
        checksum: 'sha256:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
    ],
  },

  // ── Integrations ─────────────────────────────────────────────────────────
  {
    name: 'Slack',
    slug: 'slack',
    type: 'integration',
    author: 'UniCore Labs',
    description:
      'Bi-directional Slack integration. Send notifications, receive commands, and sync conversations into the UniCore inbox.',
    icon: 'slack',
    downloads: 21500,
    rating: 4.8,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Send and receive messages via Slack Webhooks.',
        artifactUrl: 'https://registry.unicore.dev/plugins/slack/1.0.0.tgz',
        checksum: 'sha256:f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Slash command support, interactive Block Kit components, and thread sync.',
        artifactUrl: 'https://registry.unicore.dev/plugins/slack/1.1.0.tgz',
        checksum: 'sha256:a7b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '2.0.0',
        changelog: 'Full Slack Events API socket-mode. OAuth2 app installation flow.',
        artifactUrl: 'https://registry.unicore.dev/plugins/slack/2.0.0.tgz',
        checksum: 'sha256:b8c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        compatibility: { minApiVersion: '1.2.0' },
      },
    ],
  },
  {
    name: 'Telegram Channel',
    slug: 'telegram-channel',
    type: 'integration',
    author: 'UniCore Labs',
    description:
      'Connects Telegram bots and channels to UniCore. Handles text, media, inline keyboards, and webhook-based updates.',
    icon: 'telegram',
    downloads: 17640,
    rating: 4.8,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Initial Telegram Bot API integration with long-polling.',
        artifactUrl: 'https://registry.unicore.dev/plugins/telegram-channel/1.0.0.tgz',
        checksum: 'sha256:c9d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Webhook mode, inline keyboard support, media message types.',
        artifactUrl: 'https://registry.unicore.dev/plugins/telegram-channel/1.1.0.tgz',
        checksum: 'sha256:d0e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        compatibility: { minApiVersion: '1.0.0' },
      },
    ],
  },
  {
    name: 'PostgreSQL Connector',
    slug: 'postgresql-connector',
    type: 'integration',
    author: 'UniCore Labs',
    description:
      'Query and mutate external PostgreSQL databases from within UniCore workflows. Supports parameterised queries, transactions, and connection pooling.',
    icon: 'postgresql',
    downloads: 9870,
    rating: 4.6,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Basic SELECT/INSERT/UPDATE/DELETE with parameterised queries.',
        artifactUrl: 'https://registry.unicore.dev/plugins/postgresql-connector/1.0.0.tgz',
        checksum: 'sha256:e1f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
      {
        semver: '1.1.0',
        changelog: 'Transaction support, connection pool configuration, and SSL options.',
        artifactUrl: 'https://registry.unicore.dev/plugins/postgresql-connector/1.1.0.tgz',
        checksum: 'sha256:f2a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        compatibility: { minApiVersion: '1.0.0', nodeVersion: '>=20' },
      },
    ],
  },
  {
    name: 'Redis Cache',
    slug: 'redis-cache',
    type: 'integration',
    author: 'UniCore Labs',
    description:
      'Read and write Redis keys from UniCore workflows. Useful for caching expensive computations, rate-limiting, and feature flags.',
    icon: 'redis',
    downloads: 7120,
    rating: 4.5,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'GET/SET/DEL/EXPIRE operations with optional key-prefix namespacing.',
        artifactUrl: 'https://registry.unicore.dev/plugins/redis-cache/1.0.0.tgz',
        checksum: 'sha256:a3b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Pub/Sub channel support, hash commands, and TTL introspection.',
        artifactUrl: 'https://registry.unicore.dev/plugins/redis-cache/1.1.0.tgz',
        checksum: 'sha256:b4c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        compatibility: { minApiVersion: '1.0.0' },
      },
    ],
  },

  // ── Workflow ──────────────────────────────────────────────────────────────
  {
    name: 'n8n Workflow Bridge',
    slug: 'n8n-workflow-bridge',
    type: 'workflow',
    author: 'UniCore Labs',
    description:
      'Triggers and monitors n8n workflows from UniCore. Supports webhook triggers, execution polling, and data mapping between platforms.',
    icon: 'n8n',
    downloads: 5430,
    rating: 4.4,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Webhook trigger and execution-result polling.',
        artifactUrl: 'https://registry.unicore.dev/plugins/n8n-workflow-bridge/1.0.0.tgz',
        checksum: 'sha256:c5d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Bidirectional data mapping, error-node detection, and retry policy.',
        artifactUrl: 'https://registry.unicore.dev/plugins/n8n-workflow-bridge/1.1.0.tgz',
        checksum: 'sha256:d6e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        compatibility: { minApiVersion: '1.0.0' },
      },
    ],
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  {
    name: 'Analytics Dashboard',
    slug: 'analytics-dashboard',
    type: 'ui',
    author: 'UniCore Labs',
    description:
      'Embeds a rich analytics widget in the UniCore dashboard. Shows conversation volume, resolution rates, agent performance, and CSAT scores.',
    icon: 'chart-bar',
    downloads: 12300,
    rating: 4.7,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Conversation volume and agent-performance charts.',
        artifactUrl: 'https://registry.unicore.dev/plugins/analytics-dashboard/1.0.0.tgz',
        checksum: 'sha256:e7f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'CSAT scores, resolution-rate funnel, date-range picker.',
        artifactUrl: 'https://registry.unicore.dev/plugins/analytics-dashboard/1.1.0.tgz',
        checksum: 'sha256:f8a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '2.0.0',
        changelog: 'Real-time WebSocket updates, drill-down by agent/channel, CSV export.',
        artifactUrl: 'https://registry.unicore.dev/plugins/analytics-dashboard/2.0.0.tgz',
        checksum: 'sha256:a9b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        compatibility: { minApiVersion: '1.2.0' },
      },
    ],
  },
  {
    name: 'Custom Theme',
    slug: 'custom-theme',
    type: 'ui',
    author: 'UniCore Labs',
    description:
      'White-label theming plugin. Override colours, typography, logo, and favicon through a visual editor — no CSS knowledge required.',
    icon: 'palette',
    downloads: 6780,
    rating: 4.5,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Colour palette and logo customisation.',
        artifactUrl: 'https://registry.unicore.dev/plugins/custom-theme/1.0.0.tgz',
        checksum: 'sha256:b0c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Typography controls, dark-mode toggle, live preview panel.',
        artifactUrl: 'https://registry.unicore.dev/plugins/custom-theme/1.1.0.tgz',
        checksum: 'sha256:c1d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        compatibility: { minApiVersion: '1.0.0' },
      },
    ],
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  {
    name: 'Email Templates',
    slug: 'email-templates',
    type: 'utility',
    author: 'UniCore Labs',
    description:
      'Manage and send transactional email templates via Resend or SMTP. Supports Handlebars variables, preview mode, and open/click tracking.',
    icon: 'mail',
    downloads: 4960,
    rating: 4.3,
    versions: [
      {
        semver: '1.0.0',
        changelog: 'Basic Handlebars template rendering and SMTP send.',
        artifactUrl: 'https://registry.unicore.dev/plugins/email-templates/1.0.0.tgz',
        checksum: 'sha256:d2e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        compatibility: { minApiVersion: '1.0.0' },
      },
      {
        semver: '1.1.0',
        changelog: 'Resend provider, template preview endpoint, click/open tracking via pixel.',
        artifactUrl: 'https://registry.unicore.dev/plugins/email-templates/1.1.0.tgz',
        checksum: 'sha256:e3f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        compatibility: { minApiVersion: '1.0.0' },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedPlugins(
  prisma: PrismaClient,
  options: { force?: boolean } = {},
): Promise<{ created: number; skipped: number }> {
  const logger = new Logger('SeedPlugins');
  let created = 0;
  let skipped = 0;

  for (const entry of PLUGIN_CATALOGUE) {
    const latest = entry.versions[entry.versions.length - 1];

    const existing = await prisma.plugin.findUnique({ where: { slug: entry.slug } });

    if (existing && !options.force) {
      logger.debug(`Skipping existing plugin: ${entry.slug}`);
      skipped++;
      continue;
    }

    if (existing && options.force) {
      await prisma.plugin.delete({ where: { slug: entry.slug } });
    }

    await prisma.plugin.create({
      data: {
        name: entry.name,
        slug: entry.slug,
        type: entry.type,
        author: entry.author,
        version: latest.semver,
        description: entry.description,
        icon: entry.icon,
        downloads: entry.downloads,
        rating: entry.rating,
        versions: {
          create: entry.versions.map((v) => ({
            semver: v.semver,
            changelog: v.changelog,
            artifactUrl: v.artifactUrl,
            checksum: v.checksum,
            compatibility: v.compatibility,
          })),
        },
      },
    });

    logger.log(`Created plugin: ${entry.slug} (${entry.versions.length} version(s))`);
    created++;
  }

  logger.log(`Seed complete — created: ${created}, skipped: ${skipped}`);
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const prisma = new PrismaClient();
  const force = process.argv.includes('--force');

  try {
    await prisma.$connect();
    const result = await seedPlugins(prisma, { force });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
