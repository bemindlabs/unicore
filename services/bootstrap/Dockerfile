# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20.20.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/bootstrap/package.json ./services/bootstrap/
RUN pnpm install --frozen-lockfile --filter @unicore/bootstrap...

FROM base AS build
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/bootstrap ./services/bootstrap
COPY templates ./templates
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/bootstrap/node_modules ./services/bootstrap/node_modules
RUN cd services/bootstrap && pnpm run build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20.20.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-bootstrap"
LABEL org.opencontainers.image.description="NestJS wizard and initial platform setup service"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/bootstrap/node_modules ./services/bootstrap/node_modules
COPY --from=build /app/services/bootstrap/dist ./services/bootstrap/dist
COPY --from=build /app/services/bootstrap/package.json ./services/bootstrap/
COPY --from=build /app/templates ./templates
WORKDIR /app/services/bootstrap
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 4500
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4500/api/v1/templates', (r) => { if (r.statusCode !== 200) process.exit(1) }).on('error', () => process.exit(1))"
CMD ["node", "dist/main"]
