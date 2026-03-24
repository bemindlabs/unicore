# syntax=docker/dockerfile:1
FROM node:20.20.1-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN echo "ignore-scripts=true" > .npmrc
COPY apps/portal-ai-dlc ./apps/portal-ai-dlc
RUN cd apps/portal-ai-dlc && pnpm install --no-frozen-lockfile
RUN cd apps/portal-ai-dlc && npx next build

FROM node:20.20.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-portal-ai-dlc"
LABEL org.opencontainers.image.description="AI-DLC Portal — standalone Next.js app for Developer Lifecycle Chat"

COPY --from=build /app/apps/portal-ai-dlc/.next ./apps/portal-ai-dlc/.next
COPY --from=build /app/apps/portal-ai-dlc/node_modules ./apps/portal-ai-dlc/node_modules
COPY --from=build /app/apps/portal-ai-dlc/package.json ./apps/portal-ai-dlc/
COPY --from=build /app/apps/portal-ai-dlc/next.config.ts ./apps/portal-ai-dlc/

WORKDIR /app/apps/portal-ai-dlc
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 3300
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://localhost:3300/ || exit 1
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3300"]
