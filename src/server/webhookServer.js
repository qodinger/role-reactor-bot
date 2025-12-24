import express from "express";
import { handleKoFiWebhook } from "../webhooks/kofi.js";
import { handleCryptoWebhook } from "../webhooks/crypto.js";
import { handleBuyMeACoffeeWebhook } from "../webhooks/buymeacoffee.js";
import { getLogger } from "../utils/logger.js";

// Import middleware
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import {
  webhookRateLimiter,
  kofiWebhookRateLimiter,
  apiRateLimiter,
} from "./middleware/rateLimiter.js";

// Import route handlers
import { healthCheck, dockerHealthCheck } from "./routes/health.js";
import { verifyWebhookToken } from "./routes/webhook.js";
import { apiInfo, apiStats, setDiscordClient } from "./routes/api.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import supporterRoutes from "./routes/supporters.js";

// Import configuration
import {
  serverConfig,
  validateConfig,
  getStartupInfo,
  checkPortAvailability,
  findAvailablePort,
} from "./config/serverConfig.js";

const logger = getLogger();
const app = express();

/**
 * Initialize server middleware
 */
async function initializeMiddleware() {
  // Configure Express to trust proxy headers (required for ngrok, reverse proxies, etc.)
  // Trust only the first proxy hop (most secure - prevents IP spoofing while allowing reverse proxies)
  // This allows express-rate-limit to correctly identify client IPs from X-Forwarded-For header
  // Use 'trust proxy: 1' instead of 'true' to only trust the first proxy (more secure)
  app.set("trust proxy", 1);

  // Basic Express middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Session middleware (for Discord OAuth)
  // Note: You'll need to install express-session: npm install express-session
  // For production, use a session store like connect-mongo or redis
  if (process.env.SESSION_SECRET) {
    try {
      const session = (await import("express-session")).default;
      app.use(
        session({
          secret: process.env.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: process.env.NODE_ENV === "production", // HTTPS only in production
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
          },
        }),
      );
      logger.info("✅ Session middleware enabled for Discord OAuth");
    } catch (_error) {
      logger.warn(
        "⚠️ express-session not installed. Install with: npm install express-session",
      );
    }
  }

  // Serve static files (for website)
  if (process.env.SERVE_STATIC === "true") {
    const { default: path } = await import("path");
    const { fileURLToPath } = await import("url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const publicPath = path.join(__dirname, "../../public");
    app.use(express.static(publicPath));
    logger.info(`📁 Serving static files from: ${publicPath}`);
  }

  // Custom middleware
  app.use(corsMiddleware);

  if (serverConfig.logging.enabled) {
    app.use(requestLogger);
  }
}

/**
 * Initialize server routes
 */
function initializeRoutes() {
  // Health check routes
  if (serverConfig.health.enabled) {
    app.get("/health", healthCheck);

    if (serverConfig.health.dockerCheck) {
      app.get("/health/docker", dockerHealthCheck);
    }
  }

  // Webhook routes with rate limiting
  app.post("/webhook/verify", webhookRateLimiter, verifyWebhookToken);
  app.post("/webhook/kofi", kofiWebhookRateLimiter, handleKoFiWebhook);
  app.post("/webhook/crypto", webhookRateLimiter, handleCryptoWebhook);
  app.post("/webhook/bmac", webhookRateLimiter, handleBuyMeACoffeeWebhook);

  // API routes with rate limiting
  app.get("/api/info", apiRateLimiter, apiInfo);
  app.get("/api/stats", apiRateLimiter, apiStats);

  // Authentication routes (Discord OAuth) with rate limiting
  // Check for DISCORD_CLIENT_ID or CLIENT_ID (they're the same value)
  if (process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID) {
    app.use("/auth", apiRateLimiter, authRoutes);
    logger.info("✅ Discord OAuth routes enabled");
  }

  // Payment routes (require authentication)
  if (process.env.COINBASE_ENABLED === "true") {
    app.use("/api/payments", paymentRoutes);
    logger.info("✅ Payment routes enabled");
  }

  // Supporter routes (public leaderboard)
  app.use("/api/supporters", apiRateLimiter, supporterRoutes);
  logger.info("✅ Supporter routes enabled");
}

/**
 * Initialize error handling
 */
function initializeErrorHandling() {
  // Error handling middleware (must be last)
  app.use(errorHandler);
  app.use(notFoundHandler);
}

/**
 * Start the unified API server
 * @returns {Promise<import('http').Server>} The HTTP server instance
 * @throws {Error} If server fails to start
 */
export async function startWebhookServer() {
  try {
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      const errorMessage = `Configuration validation failed: ${configValidation.errors.join(", ")}`;
      logger.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Check port availability before starting server
    logger.info(
      `🔍 Checking port availability for port ${serverConfig.port}...`,
    );
    const portCheck = await checkPortAvailability(serverConfig.port);

    if (!portCheck.available) {
      logger.warn(portCheck.message);
      logger.info(portCheck.suggestion);

      // Try to find an available port
      logger.info(`🔍 Searching for an available port...`);
      const availablePort = await findAvailablePort(serverConfig.port, 10);

      if (availablePort) {
        logger.info(`✅ Found available port: ${availablePort}`);
        logger.info(
          `💡 Starting server on port ${availablePort} instead of ${serverConfig.port}`,
        );
        serverConfig.port = availablePort;
      } else {
        const errorMessage = `❌ No available ports found. Please free up port ${serverConfig.port} or set a different port with API_PORT environment variable.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    } else {
      logger.info(portCheck.message);
    }

    // Initialize server components
    await initializeMiddleware();
    initializeRoutes();
    initializeErrorHandling();

    // Start server - bind to 0.0.0.0 to allow external connections (required for webhooks)
    const server = app.listen(serverConfig.port, "0.0.0.0", () => {
      const startupInfo = getStartupInfo();

      logger.info(`🚀 Unified API server started successfully`);
      logger.info(`📊 Server Information:`, startupInfo);
      logger.info(`🌐 Available endpoints:`);
      logger.info(`  Health: http://localhost:${serverConfig.port}/health`);

      if (serverConfig.health.dockerCheck) {
        logger.info(
          `  Health (Docker): http://localhost:${serverConfig.port}/health/docker`,
        );
      }

      logger.info(
        `  Verify: http://localhost:${serverConfig.port}/webhook/verify`,
      );
      logger.info(
        `  Ko-fi: http://localhost:${serverConfig.port}/webhook/kofi`,
      );
      logger.info(
        `  Crypto: http://localhost:${serverConfig.port}/webhook/crypto`,
      );
      logger.info(`  API Info: http://localhost:${serverConfig.port}/api/info`);
      logger.info(
        `  API Stats: http://localhost:${serverConfig.port}/api/stats`,
      );

      if (process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID) {
        logger.info(
          `  Discord OAuth: http://localhost:${serverConfig.port}/auth/discord`,
        );
      }

      if (process.env.SERVE_STATIC === "true") {
        logger.info(`  Website: http://localhost:${serverConfig.port}/`);
      }
    });

    // Handle server errors
    server.on("error", error => {
      if (error.code === "EADDRINUSE") {
        logger.error(
          `❌ Port ${serverConfig.port} is already in use. Server failed to start.`,
        );
        logger.error(
          `💡 Please check if another process is using port ${serverConfig.port} or set a different port with API_PORT environment variable.`,
        );
      } else {
        logger.error(`❌ Server error:`, error);
      }
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      logger.info("🔄 Received SIGTERM, shutting down gracefully...");
      server.close(() => {
        logger.info("✅ Server closed successfully");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      logger.info("🔄 Received SIGINT, shutting down gracefully...");
      server.close(() => {
        logger.info("✅ Server closed successfully");
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    logger.error(`❌ Failed to start unified API server:`, error);
    throw error;
  }
}

/**
 * Get the Express app instance (for testing)
 * @returns {import('express').Application} The Express app instance
 */
export function getApp() {
  return app;
}

/**
 * Get server configuration
 * @returns {Object} Server configuration object
 */
export function getServerConfig() {
  return serverConfig;
}

/**
 * Set Discord client for API endpoints
 * @param {import('discord.js').Client} client - Discord.js client instance
 */
export function setClient(client) {
  setDiscordClient(client);
}

export default app;
