# Multi-stage build for better security
FROM node:22-alpine AS base

# Install build tools
RUN apk add --no-cache --update \
    ca-certificates \
    build-base \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@latest

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache --update \
    ca-certificates \
    bash \
    && apk del --purge \
    && apk cache clean

# Create non-root user
RUN addgroup -g 1001 -S botuser \
    && adduser -S botuser -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy dependencies from base stage
COPY --from=base /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --chown=botuser:botuser . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R botuser:botuser logs

# Set environment
ENV NODE_ENV=production

# Switch to non-root user
USER botuser

# Expose port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3030/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the bot using the startup script
CMD ["./scripts/docker-startup.sh"] 