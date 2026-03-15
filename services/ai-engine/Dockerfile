FROM node:20-alpine AS base
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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/ai-engine/node_modules ./services/ai-engine/node_modules
COPY --from=build /app/services/ai-engine/dist ./services/ai-engine/dist
COPY --from=build /app/services/ai-engine/package.json ./services/ai-engine/
WORKDIR /app/services/ai-engine
EXPOSE 4200
CMD ["node", "dist/main"]
