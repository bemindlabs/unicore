# syntax=docker/dockerfile:1
FROM node:20.20.1-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN echo "ignore-scripts=true" > .npmrc
COPY apps/portal-geek ./apps/portal-geek
RUN cd apps/portal-geek && pnpm install --no-frozen-lockfile
RUN cd apps/portal-geek && npx next build

FROM node:20.20.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3200
ENV HOSTNAME=0.0.0.0
LABEL org.opencontainers.image.source="https://github.com/bemindlabs/unicore"
LABEL org.opencontainers.image.vendor="BeMind Technology"
LABEL org.opencontainers.image.title="unicore-portal-geek"
LABEL org.opencontainers.image.description="Geek Portal — standalone Next.js app for Geek CLI license holders"

COPY --from=build /app/apps/portal-geek/.next/standalone ./
COPY --from=build /app/apps/portal-geek/.next/static ./apps/portal-geek/.next/static

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 appuser
USER appuser
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://localhost:3200/ || exit 1
CMD ["node", "apps/portal-geek/server.js"]
