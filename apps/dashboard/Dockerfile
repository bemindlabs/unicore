# syntax=docker/dockerfile:1
ARG BUILDPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:20.20.1-alpine AS build
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
# Copy workspace config + package.jsons for install
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
# Copy all workspace source first, then install
RUN echo "ignore-scripts=true" > .npmrc
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY packages/branding ./packages/branding
COPY packages/branding-base ./packages/branding-base
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --no-frozen-lockfile
RUN cd packages/shared-types && npx tsc
RUN cd packages/branding-base && npx tsc 2>&1 || echo "branding-base tsc failed"
RUN cd packages/branding && npx tsc 2>&1 || echo "branding tsc failed"
# Ensure workspace symlinks resolve for both root and app-level node_modules
RUN for dir in node_modules apps/dashboard/node_modules; do \
      mkdir -p $dir/@bemindlabs && \
      ln -sf /app/packages/shared-types $dir/@bemindlabs/unicore-shared-types && \
      ln -sf /app/packages/ui $dir/@bemindlabs/unicore-ui && \
      ln -sf /app/packages/config $dir/@bemindlabs/unicore-config && \
      ln -sf /app/packages/branding $dir/@bemindlabs/unicore-branding && \
      ln -sf /app/packages/branding-base $dir/@bemindlabs/unicore-branding-base; \
    done
RUN cd apps/dashboard && NEXT_PRIVATE_STANDALONE=true npx next build --no-turbopack

ARG VERSION=0.0.0
FROM --platform=$TARGETPLATFORM node:20.20.1-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-dashboard"
LABEL org.opencontainers.image.description="Next.js 16 frontend dashboard for UniCore"
LABEL org.opencontainers.image.version="${VERSION}"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/
COPY --from=build /app/apps/dashboard/next.config.js ./apps/dashboard/
COPY --from=build /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/dashboard
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
