FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/bootstrap/package.json ./services/bootstrap/
RUN pnpm install --frozen-lockfile --filter @unicore/bootstrap...

FROM base AS build
COPY --from=deps /app/ ./
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/bootstrap ./services/bootstrap
COPY tsconfig.json ./
RUN cd services/bootstrap && pnpm run build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/ ./
COPY --from=build /app/services/bootstrap/dist ./services/bootstrap/dist
COPY templates ./templates
WORKDIR /app/services/bootstrap
EXPOSE 4500
CMD ["node", "dist/main"]
