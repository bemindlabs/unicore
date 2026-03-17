# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/bootstrap/package.json ./services/bootstrap/
RUN pnpm install --frozen-lockfile --filter @unicore/bootstrap...

FROM base AS build
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY services/bootstrap ./services/bootstrap
COPY templates ./templates
COPY tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/bootstrap/node_modules ./services/bootstrap/node_modules
RUN cd services/bootstrap && pnpm run build

FROM --platform=$TARGETPLATFORM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/bootstrap/node_modules ./services/bootstrap/node_modules
COPY --from=build /app/services/bootstrap/dist ./services/bootstrap/dist
COPY --from=build /app/services/bootstrap/package.json ./services/bootstrap/
COPY --from=build /app/templates ./templates
WORKDIR /app/services/bootstrap
EXPOSE 4500
CMD ["node", "dist/main"]
