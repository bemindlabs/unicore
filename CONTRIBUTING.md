# Contributing to UniCore

Updated: 2026-03-22

Thank you for your interest in contributing to UniCore! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project adheres to our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/unicore.git
   cd unicore
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Set up your environment:
   ```bash
   cp .env.example .env
   ```
5. Start infrastructure:
   ```bash
   docker compose up -d
   ```
6. Run in development mode:
   ```bash
   pnpm dev
   ```

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10.30+
- Docker Engine 24+ / Compose v2+

### Monorepo Structure

UniCore uses [Turborepo](https://turbo.build/) with [pnpm workspaces](https://pnpm.io/workspaces):

- `apps/` — Frontend applications (Next.js)
- `services/` — Backend microservices (NestJS)
- `packages/` — Shared libraries and configurations

### Running Individual Services

```bash
pnpm --filter @unicore/dashboard dev        # Frontend
pnpm --filter @unicore/api-gateway dev      # API Gateway
pnpm --filter @unicore/erp dev              # ERP Service
```

### Database

UniCore uses Prisma with `db push` (not migrations):

```bash
# Push schema changes
cd services/api-gateway && npx prisma db push
cd services/erp && npx prisma db push
```

## Branch Strategy

| Branch | Purpose |
|:-------|:--------|
| `main` | Stable, production-ready code |
| `feature/<scope>-<description>` | New features |
| `fix/<scope>-<description>` | Bug fixes |
| `docs/<description>` | Documentation changes |
| `refactor/<scope>-<description>` | Code refactoring |

Always branch from `main` and open PRs back to `main`.

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

### Types

| Type | Description |
|:-----|:------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, or auxiliary changes |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Scopes

Use the service or package name: `dashboard`, `api-gateway`, `erp`, `ai-engine`, `rag`, `openclaw`, `bootstrap`, `workflow`, `shared-types`, `ui`, `config`.

### Examples

```
feat(erp): add low-stock alert notifications
fix(api-gateway): resolve JWT refresh token expiry
docs(readme): update deployment instructions
refactor(openclaw): extract agent registry to dedicated controller
test(erp): add inventory CRUD e2e tests
```

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, focused commits
3. **Run quality checks** before submitting:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. **Push your branch** and open a PR against `main`
5. **Fill out the PR template** with a summary, test plan, and any breaking changes
6. **Request a review** from a maintainer
7. **Address feedback** and keep the PR up to date with `main`

### PR Requirements

- All CI checks must pass
- At least one maintainer approval
- No unresolved review comments
- Commit history should be clean and logical

## Coding Standards

### TypeScript

- Strict mode enabled (`strict: true`)
- Prefer `interface` over `type` for object shapes
- Use explicit return types on exported functions
- Avoid `any` — use `unknown` with type guards when needed

### Frontend (Next.js)

- Use App Router conventions (`app/` directory)
- Server Components by default; add `'use client'` only when needed
- Use shadcn/ui components from `@unicore/ui`
- Style with Tailwind CSS utility classes

### Backend (NestJS)

- Follow NestJS module patterns (controller, service, module)
- Use DTOs with class-validator for request validation
- Inject dependencies via constructor
- Use the `Logger` service (not `console.log`)

### Testing

- Unit tests alongside source files (`*.spec.ts`)
- E2E tests in the `e2e/` directory
- Use Page Object Model (POM) pattern for Playwright tests
- Aim for meaningful coverage, not percentage targets

## Reporting Bugs

Open an issue using the **Bug Report** template and include:

1. A clear, descriptive title
2. Steps to reproduce
3. Expected vs. actual behavior
4. Environment details (OS, Node.js version, browser)
5. Relevant logs or screenshots

## Requesting Features

Open an issue using the **Feature Request** template and include:

1. Problem statement — what are you trying to solve?
2. Proposed solution — how should it work?
3. Alternatives considered
4. Any additional context

## Questions?

Open a [Discussion](https://github.com/bemindlabs/unicore/discussions) for questions, ideas, or general conversation about the project.

---

Thank you for helping make UniCore better!
