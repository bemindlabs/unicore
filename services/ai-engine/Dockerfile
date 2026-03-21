# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20.20.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/ai-engine/package.json ./services/ai-engine/
RUN pnpm install --frozen-lockfile --filter @unicore/ai-engine...

FROM base AS build
COPY packages/config ./packages/config
COPY services/ai-engine ./services/ai-engine
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/ai-engine/node_modules ./services/ai-engine/node_modules
RUN cd services/ai-engine && pnpm run build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20.20.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-ai-engine"
LABEL org.opencontainers.image.description="NestJS AI model orchestration engine"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/ai-engine/node_modules ./services/ai-engine/node_modules
COPY --from=build /app/services/ai-engine/dist ./services/ai-engine/dist
COPY --from=build /app/services/ai-engine/package.json ./services/ai-engine/
WORKDIR /app/services/ai-engine
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 4200
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4200/api/v1/llm/health', (r) => { if (r.statusCode !== 200) process.exit(1) }).on('error', () => process.exit(1))"
CMD ["node", "dist/main"]
