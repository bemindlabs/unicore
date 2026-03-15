FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/workflow/package.json ./services/workflow/
RUN pnpm install --frozen-lockfile --filter @unicore/workflow... && mkdir -p packages/shared-types/node_modules packages/config/node_modules

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/services/workflow/node_modules ./services/workflow/node_modules
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/workflow ./services/workflow
COPY tsconfig.json ./
RUN cd services/workflow && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/workflow/dist ./dist
COPY --from=build /app/services/workflow/node_modules ./node_modules
COPY --from=build /app/services/workflow/package.json ./
CMD ["node", "dist/main"]
