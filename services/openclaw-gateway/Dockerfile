FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/openclaw-gateway/package.json ./services/openclaw-gateway/
RUN pnpm install --frozen-lockfile --filter @unicore/openclaw-gateway...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/services/openclaw-gateway/node_modules ./services/openclaw-gateway/node_modules
COPY packages/config ./packages/config
COPY services/openclaw-gateway ./services/openclaw-gateway
COPY tsconfig.json ./
RUN cd services/openclaw-gateway && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/openclaw-gateway/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/openclaw-gateway/package.json ./
EXPOSE 18789
CMD ["node", "dist/main"]
