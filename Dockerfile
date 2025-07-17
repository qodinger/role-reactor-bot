# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Install CA certificates for MongoDB Atlas SSL and pnpm in one layer
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    npm install -g pnpm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and lock file
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

# Create non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser botuser

# Change ownership of the app directory
RUN chown -R botuser:botuser /usr/src/app

# Switch to non-root user
USER botuser

# Expose port (if needed for health checks)
EXPOSE 3000

# Start the bot
CMD ["node", "src/index.js"] 