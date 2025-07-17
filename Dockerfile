# Multi-stage build for better security
FROM node:20-alpine3.19 AS base

# Install security updates and pnpm
RUN apk add --no-cache --update \
    ca-certificates \
    && npm install -g pnpm@latest \
    && apk del --purge \
    && apk cache clean

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Production stage
FROM node:20-alpine3.19 AS production

# Install security updates
RUN apk add --no-cache --update ca-certificates \
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

# Set environment
ENV NODE_ENV=production

# Switch to non-root user
USER botuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the bot
CMD ["node", "src/index.js"] 