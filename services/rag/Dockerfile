FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY services/rag/package.json ./services/rag/
RUN pnpm install --frozen-lockfile --filter @unicore/rag...

FROM base AS build
COPY --from=deps /app/ ./
COPY packages/config ./packages/config
COPY services/rag ./services/rag
COPY tsconfig.json ./
RUN cd services/rag && pnpm run build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/ ./
COPY --from=build /app/services/rag/dist ./services/rag/dist
WORKDIR /app/services/rag
EXPOSE 4300
CMD ["node", "dist/main"]
