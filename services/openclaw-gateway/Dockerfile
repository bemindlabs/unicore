# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20.20.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/openclaw-gateway/package.json ./services/openclaw-gateway/
RUN pnpm install --frozen-lockfile --filter @unicore/openclaw-gateway...

FROM base AS build
COPY packages/config ./packages/config
COPY services/openclaw-gateway ./services/openclaw-gateway
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/openclaw-gateway/node_modules ./services/openclaw-gateway/node_modules
RUN cd services/openclaw-gateway && pnpm run build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20.20.1-alpine AS runner
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
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 18789 18790
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:18790/health || exit 1
CMD ["node", "dist/main"]
