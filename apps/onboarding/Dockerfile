FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/onboarding/package.json ./apps/onboarding/
RUN pnpm install --frozen-lockfile --filter @unicore/onboarding... && mkdir -p packages/shared-types/node_modules packages/config/node_modules

FROM base AS build
ARG NEXT_PUBLIC_BOOTSTRAP_SECRET
ENV NEXT_PUBLIC_BOOTSTRAP_SECRET=$NEXT_PUBLIC_BOOTSTRAP_SECRET
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/apps/onboarding/node_modules ./apps/onboarding/node_modules
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY apps/onboarding ./apps/onboarding
COPY tsconfig.json ./
RUN cd apps/onboarding && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/onboarding/.next ./.next
COPY --from=build /app/apps/onboarding/public ./public
COPY --from=build /app/apps/onboarding/node_modules ./node_modules
COPY --from=build /app/apps/onboarding/package.json ./
COPY --from=build /app/apps/onboarding/next.config.js ./
EXPOSE 3100
CMD ["npx", "next", "start", "-p", "3100"]
