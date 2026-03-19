# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/rag/package.json ./services/rag/
RUN pnpm install --frozen-lockfile --filter @unicore/rag...

FROM base AS build
COPY packages/config ./packages/config
COPY services/rag ./services/rag
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/rag/node_modules ./services/rag/node_modules
RUN cd services/rag && pnpm run build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-rag"
LABEL org.opencontainers.image.description="NestJS vector search service with Qdrant integration"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/rag/node_modules ./services/rag/node_modules
COPY --from=build /app/services/rag/dist ./services/rag/dist
COPY --from=build /app/services/rag/package.json ./services/rag/
WORKDIR /app/services/rag
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 4300
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4300/health', (r) => { if (r.statusCode !== 200) process.exit(1) }).on('error', () => process.exit(1))"
CMD ["node", "dist/main"]
