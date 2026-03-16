FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/workflow/package.json ./services/workflow/
RUN pnpm install --frozen-lockfile --filter @unicore/workflow...

FROM base AS build
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/workflow ./services/workflow
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/workflow/node_modules ./services/workflow/node_modules
RUN cd services/workflow && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/workflow/node_modules ./services/workflow/node_modules
COPY --from=build /app/services/workflow/dist ./services/workflow/dist
COPY --from=build /app/services/workflow/package.json ./services/workflow/
WORKDIR /app/services/workflow
EXPOSE 4400
CMD ["node", "dist/main"]
