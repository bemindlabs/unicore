FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --frozen-lockfile --filter @unicore/dashboard...

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Copy source first
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY apps/dashboard ./apps/dashboard
COPY tsconfig.json ./
# Then overlay deps
# Overlay all deps from pnpm install
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ ./packages/
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
# Re-copy source (overwrite package.json-only dirs from deps)
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
RUN cd packages/shared-types && pnpm run build
RUN cd apps/dashboard && pnpm run build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/
COPY --from=build /app/apps/dashboard/next.config.js ./apps/dashboard/
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
