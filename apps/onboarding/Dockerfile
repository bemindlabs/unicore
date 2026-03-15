FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/onboarding/package.json ./apps/onboarding/
RUN pnpm install --frozen-lockfile --filter @unicore/onboarding...

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BOOTSTRAP_URL
ARG NEXT_PUBLIC_BOOTSTRAP_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BOOTSTRAP_URL=$NEXT_PUBLIC_BOOTSTRAP_URL
ENV NEXT_PUBLIC_BOOTSTRAP_SECRET=$NEXT_PUBLIC_BOOTSTRAP_SECRET
# Copy source first
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY apps/onboarding ./apps/onboarding
COPY tsconfig.json ./
# Then overlay deps (node_modules excluded by .dockerignore so no conflict)
# Overlay all deps from pnpm install
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ ./packages/
COPY --from=deps /app/apps/onboarding/node_modules ./apps/onboarding/node_modules
# Re-copy source (overwrite package.json-only dirs from deps)
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
RUN cd apps/onboarding && pnpm run build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/onboarding/node_modules ./apps/onboarding/node_modules
COPY --from=build /app/apps/onboarding/.next ./apps/onboarding/.next
COPY --from=build /app/apps/onboarding/public ./apps/onboarding/public
COPY --from=build /app/apps/onboarding/package.json ./apps/onboarding/
COPY --from=build /app/apps/onboarding/next.config.js ./apps/onboarding/
WORKDIR /app/apps/onboarding
EXPOSE 3100
CMD ["npx", "next", "start", "-p", "3100"]
