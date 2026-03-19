# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BOOTSTRAP_SECRET
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_EDITION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BOOTSTRAP_SECRET=$NEXT_PUBLIC_BOOTSTRAP_SECRET
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_EDITION=$NEXT_PUBLIC_EDITION
# Copy workspace config + all package.jsons for install
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --no-frozen-lockfile
RUN echo "=== AFTER INSTALL ===" && \
    ls -la packages/ui/node_modules/ 2>/dev/null | head -20 && \
    echo "---" && \
    ls -la packages/ui/ 2>/dev/null | head -10 && \
    echo "---FIND---" && \
    find packages/ui -name "node_modules" -type d 2>/dev/null
# Copy source
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY apps/dashboard ./apps/dashboard
RUN echo "=== AFTER SOURCE COPY ===" && ls -la packages/ui/node_modules/@radix-ui/ 2>/dev/null || echo "NO RADIX IN UI NODE_MODULES" && \
    ls node_modules/.pnpm | grep radix | head -5 || echo "NO RADIX IN PNPM STORE" && \
    ls node_modules/@radix-ui/ 2>/dev/null || echo "NO RADIX IN ROOT NODE_MODULES"
RUN cd packages/shared-types && node $(ls /app/node_modules/.pnpm/typescript@*/node_modules/typescript/bin/tsc)
RUN cd apps/dashboard && node $(ls /app/node_modules/.pnpm/next@*/node_modules/next/dist/bin/next) build

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-dashboard"
LABEL org.opencontainers.image.description="Next.js 14 frontend dashboard for UniCore"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/
COPY --from=build /app/apps/dashboard/next.config.js ./apps/dashboard/
WORKDIR /app/apps/dashboard
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 3000
CMD ["npx", "next", "-p", "3000"]
