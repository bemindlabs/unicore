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
COPY services/api-gateway/package.json ./services/api-gateway/
RUN pnpm install --frozen-lockfile --filter @unicore/api-gateway...

FROM base AS build
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/api-gateway ./services/api-gateway
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api-gateway/node_modules ./services/api-gateway/node_modules
RUN cd services/api-gateway && npx prisma generate --schema=src/prisma/schema.prisma 2>/dev/null; pnpm run build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20.20.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-api-gateway"
LABEL org.opencontainers.image.description="NestJS REST API gateway and authentication service"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/api-gateway/node_modules ./services/api-gateway/node_modules
COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=build /app/services/api-gateway/package.json ./services/api-gateway/
COPY --from=build /app/services/api-gateway/src/prisma ./services/api-gateway/prisma
COPY --from=build /app/services/api-gateway/src/generated ./services/api-gateway/dist/generated
WORKDIR /app/services/api-gateway
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:4000/api/v1/health || exit 1
CMD ["node", "dist/main"]
