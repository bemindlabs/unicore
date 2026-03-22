# Plugin System Architecture

Updated: 2026-03-22

> Research document for UniCore platform — plugin SDK, runtime sandboxing, distribution, and security.

---

## Executive Summary

UniCore needs a plugin system that lets third-party developers extend the platform without compromising the stability or security of the core system. Based on analysis of Shopify Apps, Figma Plugins, VS Code Extensions, and Obsidian Plugins, the recommended approach for UniCore is:

- **Runtime**: `isolated-vm` (V8 isolates) for trusted plugin developers; Docker sidecars for untrusted/heavy plugins.
- **SDK**: TypeScript-first with lifecycle hooks, typed event bus, scoped API clients, and React extension points.
- **Distribution**: Private Verdaccio registry with a marketplace web UI for discovery and one-click install.
- **Security**: Capability-based scoped JWTs, declared permission manifest, CPU/memory limits enforced by the runtime.

This architecture maps naturally onto UniCore's NestJS backend (plugin host) and Next.js frontend (UI extension points), while integrating with OpenClaw agents, the Kafka workflow engine, and the ERP data layer.

---

## 1. Plugin SDK Design

### 1.1 TypeScript SDK with Lifecycle Hooks

Every plugin exports a single entry point that implements the `UniCorePlugin` interface:

```ts
export interface UniCorePlugin {
  onInstall(ctx: PluginContext): Promise<void>;
  onEnable(ctx: PluginContext): Promise<void>;
  onDisable(ctx: PluginContext): Promise<void>;
  onUninstall(ctx: PluginContext): Promise<void>;
}
```

`PluginContext` is injected by the host at each lifecycle stage and provides:
- `api` — scoped API client (see §1.3)
- `events` — typed event bus (see §1.2)
- `storage` — key-value store isolated per plugin
- `logger` — structured logger forwarded to the host log stream
- `config` — plugin configuration values declared in the manifest

Lifecycle semantics mirror VS Code's extension activation model: `onInstall` runs once on first installation (schema migrations, seed data); `onEnable`/`onDisable` run on every system restart or manual toggle; `onUninstall` does teardown (drop custom tables, revoke webhooks).

### 1.2 Event Subscription System (Pub/Sub)

The host exposes a typed event bus over which core services emit domain events. Plugins subscribe using string topics, identical to how Shopify webhooks map to lifecycle topics:

```ts
ctx.events.on('crm.contact.created', async (payload: ContactCreatedEvent) => {
  // handler
});

ctx.events.emit('plugin.myPlugin.scoreUpdated', { contactId, score });
```

Core topics include: `crm.*`, `inventory.*`, `invoice.*`, `workflow.step.*`, `ai.completion.*`, `auth.*`. Plugin-emitted events are namespaced under `plugin.<pluginId>.*` to prevent collisions. The event bus is backed by the existing Kafka infrastructure for cross-service delivery and by an in-process EventEmitter for same-process subscriptions.

### 1.3 API Access Scoping

Plugins receive a scoped API client — not a full admin token. The client wraps the API Gateway's internal REST surface but enforces the permissions declared in the plugin manifest:

```ts
// Allowed: plugin declared read:contacts
const contacts = await ctx.api.crm.contacts.list();

// Throws PermissionDeniedError: not declared in manifest
await ctx.api.crm.contacts.delete(id);
```

The API client is generated from the OpenAPI spec at build time, giving full TypeScript autocompletion. Access is enforced server-side via capability tokens (see §5.2), so a compromised plugin cannot escalate by calling the API directly.

### 1.4 UI Extension Points

Frontend extension is modelled on VS Code contribution points and Figma's plugin iframe approach:

| Extension Point | Host Location | Mechanism |
|---|---|---|
| Dashboard widget | Main dashboard grid | React component, lazy-loaded |
| Sidebar panel | Left navigation | Named slot, icon + panel |
| Settings page | Settings → Plugins | Full-page React component |
| Modal trigger | Triggered via event | Plugin emits `ui.openModal` event |
| Context menu item | Contact/invoice/product lists | Registered via manifest |
| Workflow node | Workflow canvas | React Flow custom node + handler |

UI components run inside a sandboxed iframe (similar to Figma) and communicate with the host via `postMessage`. The iframe approach isolates plugin CSS and JavaScript from the host page, preventing XSS and style bleed. A typed `PluginBridge` SDK provides a promise-based postMessage wrapper.

### 1.5 Plugin Manifest Format

```json
{
  "name": "@acme/unicore-crm-enrichment",
  "version": "1.2.0",
  "unicoreVersion": ">=1.0.0",
  "displayName": "CRM Enrichment",
  "description": "Enrich contacts with LinkedIn and Clearbit data.",
  "author": "Acme Corp <dev@acme.com>",
  "license": "MIT",
  "entryPoint": "dist/index.js",
  "uiEntryPoint": "dist/ui/index.html",
  "permissions": [
    "read:contacts",
    "write:contacts",
    "read:settings",
    "network:outbound:api.clearbit.com",
    "network:outbound:api.linkedin.com"
  ],
  "extensionPoints": ["sidebar.panel", "crm.contact.contextMenu"],
  "config": {
    "clearbitApiKey": { "type": "secret", "label": "Clearbit API Key" }
  }
}
```

Permissions are explicit and minimal. Network egress is allowlisted per host, preventing data exfiltration to arbitrary domains.

---

## 2. Plugin Runtime and Sandboxing

### 2.1 Candidate Approaches

#### VM2
The long-standing Node.js sandboxing library. **Deprecated and unmaintained as of 2023** with known sandbox escape CVEs. Not suitable for production use.

#### isolated-vm
Uses V8 Isolates — the same mechanism V8 uses internally for iframes. Each plugin gets a separate V8 heap with no shared references. The host explicitly passes values into the isolate using `copy`, `reference`, or `ExternalCopy`. Active maintenance, used in production by Cloudflare Workers.

**Strengths**: low overhead (~3 ms cold start), fine-grained memory limits (`maxOldGenerationSizeMb`), CPU time limits (`timeout`), no native module access. Fits naturally inside a NestJS service.

#### Docker Sidecar
Each plugin runs as a separate Docker container. The host communicates via HTTP or gRPC. Provides full OS-level isolation.

**Strengths**: unlimited language support, full resource control (cgroups), complete filesystem isolation.

**Weaknesses**: 300–800 ms startup time per plugin, high memory overhead (~50 MB/plugin for Node.js baseline), complex networking, difficult DX for local development.

#### WebAssembly (Wasmer/Wasmtime)
Plugins compiled to WASM. The runtime enforces capability-based I/O (WASI interface). Language-agnostic.

**Strengths**: near-native performance, strong sandbox guarantees, polyglot.

**Weaknesses**: TypeScript/JavaScript → WASM toolchain is immature; no direct DOM access; limited ecosystem for NestJS-style plugins today.

### 2.2 Decision Matrix

| Criterion | isolated-vm | Docker Sidecar | WASM |
|---|---|---|---|
| Security isolation | High (V8 isolate) | Very High (OS) | Very High (WASI) |
| Cold start latency | ~3 ms | 300–800 ms | ~5 ms |
| Memory overhead | ~5 MB/plugin | ~50–150 MB/plugin | ~2 MB/plugin |
| CPU time enforcement | Yes (timeout param) | Yes (cgroups) | Yes (fuel metering) |
| TS/JS DX | Native | Good (any lang) | Poor (no TS→WASM today) |
| NestJS integration | Native (npm package) | Requires sidecar mgmt | Requires WASM host |
| Network restriction | Manual (block require) | iptables/firewall | WASI net capability |
| Maintenance risk | Low (active) | Low (Docker is stable) | Medium (toolchain flux) |

### 2.3 Recommendation

**Use `isolated-vm` as the default runtime** for TypeScript/JavaScript plugins. It integrates directly into the NestJS `PluginManagerModule`, imposes negligible overhead, and matches the DX of VS Code extension development.

**Use Docker sidecars** for "heavy" or untrusted plugins (e.g., plugins that need native binaries, Python, or access to large ML models). The plugin manifest declares `"runtime": "sidecar"` and the host provisions a container from a declared image.

This two-tier model (isolate for lightweight, container for heavy) mirrors Shopify's approach of serverless functions for simple logic versus app extensions running on dedicated infrastructure for complex workloads.

---

## 3. Plugin Types

### 3.1 Agent Plugins
Extend the OpenClaw multi-agent system (port 18789/18790). An agent plugin registers a new agent type with a system prompt, tool definitions, and routing rules. The plugin receives a WebSocket client scoped to the OpenClaw gateway and can spawn sub-agents or subscribe to agent events.

### 3.2 Integration Adapters
Provide typed clients for external APIs (Salesforce, HubSpot, Stripe, QuickBooks). They implement a standard `IntegrationAdapter` interface so the ERP service can call them uniformly. Adapters declare `network:outbound` permissions for their target domains.

### 3.3 Workflow Nodes
Custom nodes for the Kafka-based workflow engine. A workflow node plugin declares input/output schemas, registers a Kafka consumer group, and exports an `execute(input) => output` handler. The workflow canvas in the dashboard loads custom nodes dynamically from the plugin registry.

### 3.4 UI Widgets
React components injected into the dashboard via the iframe extension point system. Packaged as self-contained bundles (Vite-built). Widgets communicate with the host through the typed `PluginBridge`.

### 3.5 Theme Packs
Tailwind CSS variable overrides and shadcn/ui token sets. A theme plugin exports a CSS file and an optional Tailwind preset. The dashboard applies themes via CSS custom properties at runtime. No JavaScript execution required — theme plugins do not need a sandbox.

---

## 4. Distribution

### 4.1 Options Comparison

| Model | Pros | Cons |
|---|---|---|
| npm public registry | Existing tooling, zero infra | Public exposure, versioning fragility |
| Private Verdaccio | Full control, scoped auth, proxies npm | Infra to maintain |
| Git URL install | Flexible, no registry | No audit trail, hard to verify signatures |
| Marketplace model | Discovery, ratings, one-click install | Requires marketplace UI development |

### 4.2 Recommendation: Hybrid (Verdaccio + Marketplace UI)

Run a **Verdaccio** private registry scoped to `@unicore-plugins/*`. Verdaccio proxies to the public npm registry for dependencies, so plugins can use any npm package. Plugin authors publish to the private registry using a scoped publish token. The **marketplace UI** (a panel in the UniCore admin dashboard) displays plugin cards, ratings, install counts, and a one-click install button that calls the Plugin Manager API. Installed plugins are recorded in the main PostgreSQL database.

---

## 5. Security Model

| Control | Implementation |
|---|---|
| Permission manifest | All permissions declared in `manifest.json`; installation fails if manifest is invalid |
| Capability JWTs | Plugin receives a JWT with `scope` claim matching declared permissions; non-scoped endpoints return 403 |
| CPU limits | `isolated-vm` `timeout` parameter; Docker cgroups for sidecar plugins |
| Memory caps | `isolated-vm` `maxOldGenerationSizeMb`; Docker `mem_limit` |
| Network egress | Outbound allowed only to hosts listed in `permissions[network:outbound:*]`; enforced by a proxy interceptor in the isolate context |
| Code signing | Authors sign packages with Ed25519 (reusing the existing crypto package from `unicore-license`); registry verifies before serving |
| No native modules | `isolated-vm` context does not expose `require`; native addons impossible |
| Filesystem isolation | Plugin storage is a scoped key-value namespace backed by Redis; no raw `fs` access |

---

## 6. Reference Implementations

- **Shopify Apps**: OAuth 2.0 scopes, webhook topic subscriptions, App Bridge for embedded UI, Polaris design system for consistency. Strongest analog for permission manifest + scoped token model.
- **Figma Plugins**: sandboxed iframe + postMessage bridge, `manifest.json` with permission declarations, Figma API injected into sandbox. Best analog for UI extension points.
- **VS Code Extensions**: activation events (`onLanguage`, `onCommand`), contribution points in `package.json`, separate extension host process. Best analog for lifecycle hooks and contribution-point registration.
- **Obsidian Plugins**: community plugin directory, `manifest.json` with `minAppVersion`, `loadData`/`saveData` for plugin storage, event system tied to the vault lifecycle. Closest analog for a small-team developer experience without heavy infrastructure.

---

## 7. Recommended Architecture for UniCore

```
unicore/services/api-gateway/
  src/plugins/
    plugin-manager.module.ts       — NestJS module, loads/unloads plugins
    plugin-registry.service.ts     — DB-backed registry of installed plugins
    plugin-runner.service.ts       — isolated-vm host, lifecycle orchestration
    plugin-events.service.ts       — typed Kafka/EventEmitter event bus
    plugin-api-scope.service.ts    — generates capability JWT for each plugin
    plugin-storage.service.ts      — Redis-backed scoped key-value store
    plugin-sidecar.service.ts      — Docker sidecar manager for heavy plugins

packages/plugin-sdk/               — Published as @unicore/plugin-sdk
  src/
    types.ts                       — UniCorePlugin, PluginContext, manifest types
    api-client.ts                  — Generated typed API client (from OpenAPI)
    event-bus.ts                   — Typed pub/sub wrapper
    plugin-bridge.ts               — postMessage bridge for UI plugins
    storage.ts                     — Plugin storage client
```

---

## 8. Implementation Roadmap

### Phase 1 — Foundation (Sprint 1–2)
- Define `manifest.json` schema and validation (zod)
- Implement `PluginManagerModule` in API Gateway with SQLite-backed registry
- Scaffold `@unicore/plugin-sdk` package with typed interfaces
- Basic `isolated-vm` runner with lifecycle hooks
- Plugin enable/disable/uninstall API endpoints

### Phase 2 — Events and API Access (Sprint 3–4)
- Integrate plugin event bus with Kafka (core topics)
- Implement capability JWT issuance and enforcement
- Generate typed API client from OpenAPI spec
- Plugin storage service (Redis namespace)
- Unit tests for sandbox escape prevention

### Phase 3 — UI Extension Points (Sprint 5–6)
- Implement iframe extension point system in Next.js dashboard
- `PluginBridge` postMessage SDK
- Dashboard widget and sidebar panel slots
- Workflow node registration from plugins

### Phase 4 — Distribution (Sprint 7–8)
- Deploy Verdaccio registry with scoped `@unicore-plugins/*` namespace
- Marketplace panel in admin dashboard (browse, install, rate)
- Ed25519 code signing integration (reuse `unicore-license/packages/crypto`)
- Plugin developer CLI: `unicore plugin init`, `unicore plugin publish`, `unicore plugin test`

### Phase 5 — Hardening (Sprint 9–10)
- CPU/memory limit enforcement and alerting
- Network egress proxy for isolate context
- Docker sidecar manager for heavy/multilingual plugins
- Security audit and penetration test of sandbox
- Plugin developer documentation and example plugins
