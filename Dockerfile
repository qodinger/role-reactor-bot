# Multi-stage build for better security
FROM node:22-alpine AS base

# Install build tools for native modules
RUN apk add --no-cache --update \
    ca-certificates \
    build-base \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@9.9.0

WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (used by development stage)
RUN pnpm install --frozen-lockfile

# Prod-deps stage: prune to production-only dependencies
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

# Development stage
FROM node:22-alpine AS development

RUN apk add --no-cache --update \
    ca-certificates \
    bash \
    && npm install -g pnpm@9.9.0

WORKDIR /usr/src/app

COPY --from=base /usr/src/app/node_modules ./node_modules

COPY . .

ENV NODE_ENV=development

EXPOSE 3030

CMD ["pnpm", "run", "dev"]

# Production stage
FROM node:22-alpine AS production

RUN apk add --no-cache --update \
    ca-certificates \
    bash

# Create non-root user
RUN addgroup -g 1001 -S botuser \
    && adduser -S botuser -u 1001

WORKDIR /usr/src/app

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --chown=botuser:botuser . .

# Ensure startup script is executable (Git may not preserve chmod +x)
RUN chmod +x ./scripts/docker-startup.sh

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R botuser:botuser logs

ENV NODE_ENV=production

USER botuser

# Note: Render Web Services inject PORT env var automatically.
# The app reads PORT (Render) or API_PORT (custom) — see src/server/config/serverConfig.js
EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3030/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["./scripts/docker-startup.sh"]
