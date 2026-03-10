<div align="center">

# UniCore

**AI-First Ecosystem Dashboard for Solopreneurs**

[![License: BSL](https://img.shields.io/badge/License-BSL_1.1-orange.svg)](LICENSE)
[![Community](https://img.shields.io/badge/Community-Free-10b981)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-Streaming-231F20?logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Multi--Agent-ff6b35?logo=openai&logoColor=white)](https://github.com/openclaw)

UniCore replaces dozens of SaaS tools with a single AI-driven platform — automating workflows, managing operations, and deploying AI agents so a 1-5 person team can operate like a full company.

</div>

---

## Project Structure

```
unicore/
├── apps/
│   ├── dashboard/                # Main operations UI (Next.js) — :3000
│   └── onboarding/               # Bootstrap wizard — first-run setup — :3100
├── services/
│   ├── api-gateway/              # Auth, routing, rate limiting (NestJS) — :4000
│   ├── erp/                      # CRM, orders, inventory, invoicing — :4100
│   ├── ai-engine/                # LLM orchestration, prompt routing — :4200
│   ├── rag/                      # Embeddings, retrieval, context — :4300
│   ├── workflow/                 # Kafka consumers, event automation — :4400
│   ├── bootstrap/                # Wizard API, templates, provisioning — :4500
│   └── openclaw-gateway/         # Multi-agent WebSocket hub — :18789
├── agents/
│   ├── router/                   # Intent classification, task delegation
│   ├── comms/                    # Email, social, outreach
│   ├── finance/                  # Transactions, forecasting, invoices
│   ├── growth/                   # Funnels, ads, A/B tests
│   ├── ops/                      # Tasks, schedules, projects
│   ├── research/                 # Market intel, competitors
│   ├── erp/                      # Natural language ERP queries
│   └── builder/                  # Code gen, deployments
├── packages/
│   ├── ui/                       # @unicore/ui — shared components (shadcn/ui)
│   ├── shared-types/             # @unicore/shared-types — TypeScript types
│   ├── config/                   # @unicore/config — ESLint, Tailwind, TS configs
│   └── integrations/             # @unicore/integrations — Stripe, Plaid adapters
├── templates/                    # Business templates (industry presets)
├── infra/                        # Dockerfiles, nginx, scripts
├── docker-compose.yml            # Infrastructure services
├── turbo.json                    # Turborepo pipeline
├── pnpm-workspace.yaml           # Monorepo workspace config
└── tsconfig.json                 # Root TypeScript config
```

## Prerequisites

| Requirement | Version |
|:---|:---|
| [Node.js](https://nodejs.org/) | 18+ |
| [pnpm](https://pnpm.io/) | 9+ |
| [Docker](https://docker.com/) | Engine 24+ / Compose v2+ |

## Getting Started

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env   # fill in your credentials

# Start infrastructure (PostgreSQL, Redis, Qdrant)
docker compose up -d

# Run database migrations
pnpm prisma migrate dev

# Start all services in dev mode
pnpm dev
```

Open **http://localhost:3000** — the Bootstrap Wizard launches automatically on first run.

### Start with Kafka (workflow events)

```bash
docker compose --profile workflows up -d
```

## Infrastructure

| Service | Container | Port |
|:---|:---|:---|
| PostgreSQL 16 | `unicore-postgres` | `5432` |
| Redis 7 | `unicore-redis` | `6379` |
| Qdrant (Vector DB) | `unicore-vectordb` | `6333` |
| Zookeeper | `unicore-zookeeper` | `2181` |
| Kafka | `unicore-kafka` | `9092` |

Zookeeper and Kafka only start with the `workflows` profile.

## Development

```bash
# Run specific app or service
pnpm --filter @unicore/dashboard dev
pnpm --filter @unicore/api-gateway dev
pnpm --filter @unicore/erp dev

# Lint, test, typecheck
pnpm lint
pnpm test
pnpm typecheck
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|:---|:---|:---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `VECTOR_DB_URL` | Yes | Qdrant vector database URL |
| `JWT_SECRET` | Yes | Auth token signing secret |
| `NEXTAUTH_SECRET` | Yes | NextAuth session encryption |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (fallback) |
| `KAFKA_BROKERS` | Yes | Kafka broker addresses |
| `OPENCLAW_API_KEY` | Yes | OpenClaw multi-agent gateway key |
| `BOOTSTRAP_SECRET` | Yes | Wizard provisioning secret |
| `UNICORE_LICENSE_KEY` | No | Pro Edition license key |

## Business Templates

Pre-configured industry presets in [`templates/`](templates/):

| Template | File |
|:---|:---|
| E-Commerce | `ecommerce.json` |
| Freelance / Agency | `freelance.json` |
| SaaS / Tech | `saas.json` |
| Retail / F&B | `retail.json` |
| Content Creator | `content-creator.json` |
| Professional Services | `professional.json` |
| Custom (blank) | `custom.json` |

Each template pre-configures ERP modules, agents, dashboard widgets, channels, and workflow rules.

## Conventions

| Convention | Format | Example |
|:---|:---|:---|
| **Branch** | `feature/<scope>-<description>` | `feature/erp-inventory-alerts` |
| **Commit** | `<type>(<scope>): <description>` | `feat(erp): add low-stock alerts` |
| **Types** | `feat`, `fix`, `docs`, `refactor`, `test`, `chore` | |

## License

Business Source License 1.1 (BSL) — [LICENSE](LICENSE)

- **Community Edition** — Free for personal and small-team use
- **Pro Edition** — Requires a valid license key for advanced features

Contact: license@unicore.dev
