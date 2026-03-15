FROM node:20-alpine AS base
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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/api-gateway/node_modules ./services/api-gateway/node_modules
COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=build /app/services/api-gateway/package.json ./services/api-gateway/
WORKDIR /app/services/api-gateway
EXPOSE 4000
CMD ["node", "dist/main"]
