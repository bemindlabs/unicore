# syntax=docker/dockerfile:1

# ─── Base (Debian slim for glibc — required by node-pty prebuilds) ───────────
FROM node:20.20.1-slim AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/openclaw-gateway/package.json ./services/openclaw-gateway/
RUN pnpm install --frozen-lockfile --filter @unicore/openclaw-gateway...
# Build node-pty native bindings (prebuilds unavailable for this platform,
# and .npmrc ignore-scripts=true may suppress install scripts)
RUN cd /app/node_modules/.pnpm/node-pty@*/node_modules/node-pty && npx node-gyp rebuild

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS build
COPY packages/config ./packages/config
COPY services/openclaw-gateway ./services/openclaw-gateway
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/openclaw-gateway/node_modules ./services/openclaw-gateway/node_modules
RUN cd services/openclaw-gateway && pnpm run build

# ─── Runner ──────────────────────────────────────────────────────────────────
ARG VERSION=0.0.0
FROM node:20.20.1-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends bash wget curl tmux && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-openclaw-gateway"
LABEL org.opencontainers.image.description="Multi-agent WebSocket gateway for OpenClaw"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/openclaw-gateway/node_modules ./services/openclaw-gateway/node_modules
COPY --from=build /app/services/openclaw-gateway/dist ./services/openclaw-gateway/dist
COPY --from=build /app/services/openclaw-gateway/package.json ./services/openclaw-gateway/
WORKDIR /app/services/openclaw-gateway
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m appuser
USER appuser
EXPOSE 18789 18790
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:18790/health || exit 1
CMD ["node", "dist/main"]
