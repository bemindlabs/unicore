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
ENV PORT=3300
ENV HOSTNAME=0.0.0.0
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-portal-ai-dlc"
LABEL org.opencontainers.image.description="AI-DLC Portal — standalone Next.js app for Developer Lifecycle Chat"

COPY --from=build /app/apps/portal-ai-dlc/.next/standalone ./
COPY --from=build /app/apps/portal-ai-dlc/.next/static ./apps/portal-ai-dlc/.next/static

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 3300
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://localhost:3300/ || exit 1
CMD ["node", "apps/portal-ai-dlc/server.js"]
