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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/services/erp/node_modules ./services/erp/node_modules
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/erp ./services/erp
COPY tsconfig.json ./
RUN cd services/erp && npx prisma generate 2>/dev/null; pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/erp/dist ./dist
COPY --from=build /app/services/erp/node_modules ./node_modules
COPY --from=build /app/services/erp/package.json ./
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4100
CMD ["node", "dist/main"]
