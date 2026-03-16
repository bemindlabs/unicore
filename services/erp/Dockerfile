FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/erp/package.json ./services/erp/
RUN pnpm install --frozen-lockfile --filter @unicore/erp...

FROM base AS build
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/erp ./services/erp
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/erp/node_modules ./services/erp/node_modules
RUN cd services/erp && npx prisma generate --schema=src/prisma/schema.prisma 2>/dev/null; pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/erp/node_modules ./services/erp/node_modules
COPY --from=build /app/services/erp/dist ./services/erp/dist
COPY --from=build /app/services/erp/src/generated ./services/erp/dist/generated
COPY --from=build /app/services/erp/package.json ./services/erp/
COPY --from=build /app/services/erp/src/prisma ./services/erp/prisma
WORKDIR /app/services/erp
EXPOSE 4100
CMD ["node", "dist/main"]
