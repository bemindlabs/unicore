FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/rag/package.json ./services/rag/
RUN pnpm install --frozen-lockfile --filter @unicore/rag...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/services/rag/node_modules ./services/rag/node_modules
COPY packages/config ./packages/config
COPY services/rag ./services/rag
COPY tsconfig.json ./
RUN cd services/rag && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/rag/dist ./dist
COPY --from=build /app/services/rag/node_modules ./node_modules
COPY --from=build /app/services/rag/package.json ./
EXPOSE 4300
CMD ["node", "dist/main"]
