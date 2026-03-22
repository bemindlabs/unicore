<div align="center">

# UniCore

Updated: 2026-03-22

**AI-First Ecosystem Dashboard for Solopreneurs**

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-orange.svg)](LICENSE)
[![Community Edition](https://img.shields.io/badge/Edition-Community-10b981)](LICENSE)
[![TypeScript 5.5](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS 10](https://img.shields.io/badge/NestJS-10.4-e0234e?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma 6](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Kafka 7.5](https://img.shields.io/badge/Kafka-7.5-231F20?logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Multi--Agent-ff6b35)](https://github.com/openclaw)

UniCore replaces dozens of SaaS tools with a single AI-driven platform — automating workflows, managing operations, and deploying AI agents so a 1-5 person team can operate like a full company.

[Getting Started](#getting-started) | [Documentation](#documentation) | [Roadmap](#roadmap) | [Contributing](CONTRIBUTING.md)

</div>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Services](#services)
- [AI Agents](#ai-agents)
- [Business Templates](#business-templates)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Features

- **AI Agent Crew** — 8 specialized agents (Router, Comms, Finance, Growth, Ops, Research, ERP, Builder) working together via WebSocket
- **ERP Suite** — CRM contacts with lead scoring, inventory management, order lifecycle (DRAFT to DELIVERED), invoicing, expenses, and financial reports
- **RAG Pipeline** — Vector search powered by Qdrant for context-aware AI responses
- **Multi-LLM Support** — OpenAI, Anthropic, and Ollama with configurable primary provider
- **Event-Driven Workflows** — Kafka-based automation for stock alerts, order confirmations, and invoice reminders
- **Bootstrap Wizard** — One-step provisioning with industry templates, admin setup, and agent registration
- **Multi-Channel Ready** — Web, Email, Slack, Telegram, LINE, WhatsApp, Facebook, Instagram, SMS
- **Role-Based Access** — Owner, Operator, Marketer, Finance, Viewer roles out of the box

## Architecture

```
                    Cloudflare (SSL)
                         |
                    Nginx (port 80)
                    /    |    \
            Dashboard  API GW  OpenClaw WS
            :3000      :4000   :18789
                       / | \
                 ERP  AI  RAG  Bootstrap  Workflow
                :4100 :4200 :4300 :4500   (Kafka)
                  |              |
             PostgreSQL      Qdrant
               :5432         :6333
                  |
                Redis
                :6379
```

## Tech Stack

| Layer | Technology | Version |
|:------|:-----------|:--------|
| **Frontend** | Next.js, React, Tailwind CSS, shadcn/ui | 14.2, 18.3, 3.4 |
| **Backend** | NestJS, Node.js | 10.4, 20+ |
| **Language** | TypeScript | 5.5 |
| **ORM** | Prisma | 6 |
| **Auth** | Passport.js (JWT + Local Strategy) | 0.7 |
| **Database** | PostgreSQL | 16 |
| **Cache** | Redis | 7 |
| **Vector DB** | Qdrant | latest |
| **Streaming** | Apache Kafka (KafkaJS) | 7.5 (2.2) |
| **AI** | OpenAI SDK, Anthropic SDK | 4.52, 0.27 |
| **WebSocket** | ws (via NestJS WebSockets) | 8.18 |
| **Build** | Turborepo, pnpm | 2.0, 10.30 |
| **Testing** | Jest, Playwright | 29, 1.58 |

## Prerequisites

| Requirement | Version |
|:------------|:--------|
| [Node.js](https://nodejs.org/) | 20+ |
| [pnpm](https://pnpm.io/) | 10.30+ |
| [Docker](https://docker.com/) | Engine 24+ / Compose v2+ |

## Getting Started

```bash
# Clone the repository
git clone https://github.com/bemindlabs/unicore.git
cd unicore

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env    # Edit with your credentials

# Start infrastructure (PostgreSQL, Redis, Qdrant)
docker compose up -d

# Push database schemas
pnpm prisma db push

# Start all services in dev mode
pnpm dev
```

Open **http://localhost:3000** — the Bootstrap Wizard launches automatically on first run.

### Start with Kafka (workflow events)

```bash
docker compose --profile workflows up -d
```

## Project Structure

```
unicore/
├── apps/
│   └── dashboard/                 # Main operations UI (Next.js)           :3000
├── services/
│   ├── api-gateway/               # Auth, routing, proxy (NestJS)          :4000
│   ├── erp/                       # CRM, orders, inventory, invoicing      :4100
│   ├── ai-engine/                 # LLM orchestration, prompt routing      :4200
│   ├── rag/                       # Embeddings, retrieval, context          :4300
│   ├── bootstrap/                 # Wizard API, templates, provisioning    :4500
│   ├── openclaw-gateway/          # Multi-agent WebSocket hub              :18789
│   └── workflow/                  # Kafka consumers, event automation
├── packages/
│   ├── ui/                        # @unicore/ui — shared components (shadcn/ui)
│   ├── shared-types/              # @unicore/shared-types — TypeScript types
│   ├── config/                    # @unicore/config — ESLint, Tailwind, TS configs
│   └── integrations/              # @unicore/integrations — 3rd-party API wrappers
├── templates/                     # Business templates (industry presets)
├── agents/                        # Agent extension points (pluggable)
├── e2e/                           # Playwright E2E tests
├── nginx/                         # Reverse proxy configuration
├── docker-compose.yml             # Infrastructure services
├── turbo.json                     # Turborepo pipeline
├── pnpm-workspace.yaml            # Monorepo workspace config
└── tsconfig.json                  # Root TypeScript config
```

## Services

| Service | Port | Description |
|:--------|:-----|:------------|
| **Dashboard** | 3000 | Next.js 14 SPA — main operations UI, backoffice, wizard |
| **API Gateway** | 4000 | REST API, JWT/local auth, service proxy, rate limiting |
| **ERP** | 4100 | CRM (lead scoring), inventory, orders, invoicing, expenses, reports |
| **AI Engine** | 4200 | Multi-provider LLM orchestration (OpenAI, Anthropic, Ollama) |
| **RAG** | 4300 | Vector embeddings and retrieval via Qdrant |
| **Bootstrap** | 4500 | Wizard provisioning, template loading, admin setup |
| **OpenClaw Gateway** | 18789 | Multi-agent WebSocket hub, agent registry, pub/sub routing |
| **Workflow** | — | Kafka consumers for event-driven automation |

### Infrastructure

| Service | Image | Port |
|:--------|:------|:-----|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Qdrant | `qdrant/qdrant:latest` | 6333 |
| Zookeeper | `confluentinc/cp-zookeeper:7.5.0` | 2181 |
| Kafka | `confluentinc/cp-kafka:7.5.0` | 9092 |
| Nginx | `nginx:alpine` | 80 |

Zookeeper and Kafka only start with the `workflows` profile.

## AI Agents

UniCore ships with 8 specialized AI agents that collaborate via the OpenClaw WebSocket gateway:

| Agent | Type | Capabilities | Default Channels |
|:------|:-----|:-------------|:-----------------|
| **Router** | `router` | Intent classification, task delegation | web |
| **Comms** | `comms` | Email drafts, social media, customer outreach | email, web |
| **Finance** | `finance` | Transaction categorization, forecasting, invoicing | web |
| **Growth** | `growth` | Funnel optimization, ad copy, A/B test analysis | web |
| **Ops** | `ops` | Task management, scheduling, project tracking | web, slack |
| **Research** | `research` | Market intelligence, competitor analysis, trends | web |
| **ERP** | `erp` | Natural language queries over ERP data | web |
| **Builder** | `builder` | Code generation, deployments, technical scaffolding | web |

Each agent supports three autonomy levels: **Full Auto**, **Approval Required**, and **Suggest Only**.

## Business Templates

Pre-configured industry presets that auto-configure ERP modules, agents, dashboard widgets, channels, and workflow rules:

| Template | Use Case |
|:---------|:---------|
| `ecommerce` | Online shops, D2C brands, dropshipping |
| `freelance` | Freelance agencies, consultancies |
| `saas` | SaaS / tech products |
| `retail` | Retail, F&B, brick-and-mortar |
| `content-creator` | Creators, influencers, media |
| `professional` | Professional services, legal, accounting |
| `custom` | Blank slate — configure everything manually |

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|:---------|:---------|:------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password (strong) |
| `JWT_SECRET` | Yes | Auth token signing (min 32 chars) |
| `BOOTSTRAP_SECRET` | Yes | Wizard provisioning secret |
| `OLLAMA_BASE_URL` | No | Ollama local endpoint (`http://localhost:11434`) |
| `LLM_PRIMARY_PROVIDER` | No | `openai`, `anthropic`, or `ollama` |

## Development

```bash
# Run specific service
pnpm --filter @unicore/dashboard dev
pnpm --filter @unicore/api-gateway dev
pnpm --filter @unicore/erp dev

# Lint, test, typecheck (all packages)
pnpm lint
pnpm test
pnpm typecheck

# Build all
pnpm build
```

### Conventions

| Convention | Format | Example |
|:-----------|:-------|:--------|
| **Branch** | `feature/<scope>-<description>` | `feature/erp-inventory-alerts` |
| **Commit** | `<type>(<scope>): <description>` | `feat(erp): add low-stock alerts` |
| **Types** | `feat`, `fix`, `docs`, `refactor`, `test`, `chore` | |

## Testing

### Unit Tests

```bash
pnpm test                    # Run all unit tests
pnpm --filter @unicore/erp test   # Run tests for a specific service
```

### E2E Tests (Playwright)

```bash
# Install browsers
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run with browser visible
npx playwright test --headed

# View HTML report
npx playwright show-report
```

E2E tests cover: API health checks, authentication flows, dashboard navigation, ERP CRUD operations, settings management, and onboarding.

## Deployment

### Docker Compose (Production)

```bash
# Start all services
docker compose --profile apps up -d

# Start with workflows (Kafka)
docker compose --profile apps --profile workflows up -d

# Rebuild a specific service
docker compose --profile apps build unicore-dashboard --no-cache
docker compose --profile apps up -d unicore-dashboard

# View logs
docker logs unicores-unicore-api-gateway-1 --tail 100 -f
```

### Post-Deploy Setup

```bash
# Push database schemas
docker exec <api-gateway-container> npx prisma db push
docker exec <erp-container> npx prisma db push

# Provision admin user
curl -X POST http://localhost:4000/auth/provision-admin \
  -H 'Content-Type: application/json' \
  -H 'X-Bootstrap-Secret: <your-secret>' \
  -d '{"email":"admin@example.com","password":"<password>","name":"Admin"}'
```

## Roadmap

### v0.1 — Foundation (Current)

- [x] Monorepo with Turborepo + pnpm workspaces
- [x] Next.js 14 dashboard with shadcn/ui
- [x] NestJS API Gateway with JWT/Local auth
- [x] ERP service (CRM, orders, inventory, invoicing, expenses)
- [x] OpenClaw multi-agent WebSocket gateway
- [x] 8 specialist AI agents with autonomy levels
- [x] Agent CRUD API (register, update, delete)
- [x] RAG service with Qdrant vector search
- [x] Bootstrap wizard with 7 industry templates
- [x] Kafka-based workflow engine
- [x] Nginx reverse proxy
- [x] Playwright E2E test suite
- [x] Docker Compose deployment

### v0.2 — Intelligence

- [ ] Agent memory and conversation persistence
- [ ] Multi-turn tool calling with chain-of-thought
- [ ] Knowledge base document ingestion (PDF, DOCX, CSV)
- [ ] Custom agent builder (Pro)
- [ ] Agent-to-agent delegation protocols
- [ ] Workflow visual builder

### v0.3 — Channels & Integrations

- [ ] Telegram bot integration
- [ ] LINE messaging channel
- [ ] WhatsApp Business API
- [ ] Slack workspace integration
- [ ] Stripe payment processing
- [ ] Plaid financial data sync

### v0.4 — Scale & Security

- [ ] SSO (SAML/OIDC) authentication (Pro)
- [ ] Role-based access control enhancements (Pro)
- [ ] Audit logging (Pro)
- [ ] Custom domain routing (Pro)
- [ ] White-label branding (Pro)
- [ ] Rate limiting and API quotas
- [ ] Horizontal scaling with Redis Cluster

### v1.0 — General Availability

- [ ] Production hardening and security audit
- [ ] Comprehensive API documentation (OpenAPI 3.0)
- [ ] Plugin marketplace for community extensions
- [ ] Self-hosted installer CLI
- [ ] Helm chart for Kubernetes deployment

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our development process, coding standards, and how to submit pull requests.

## License

[Business Source License 1.1](LICENSE) (BSL 1.1)

- **Community Edition** — Free for personal and small-team use
- **Pro Edition** — Requires a valid license key for advanced features

Licensor: [BeMind Technology](https://bemind.tech)
Contact: license@unicore.dev
