/**
 * @fileoverview Unified API Server for Role Reactor Bot
 *
 * This module provides a unified Express.js server that handles:
 * - Health checks and monitoring
 * - Webhook endpoints (Ko-fi, testing, verification)
 * - General API endpoints
 * - CORS support for external access
 * - Centralized error handling and logging
 *
 * @author Tyecode
 * @version 1.0.0
 * @license MIT
 */

import express from "express";
import { handleKoFiWebhook } from "../webhooks/kofi.js";
import { getLogger } from "../utils/logger.js";

// Import middleware
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Import route handlers
import { healthCheck, dockerHealthCheck } from "./routes/health.js";
import {
  testWebhookGet,
  testWebhookPost,
  verifyWebhookToken,
} from "./routes/webhook.js";
import { apiStatus, apiInfo } from "./routes/api.js";

// Import configuration
import {
  serverConfig,
  validateConfig,
  getStartupInfo,
} from "./config/serverConfig.js";

const logger = getLogger();
const app = express();

/**
 * Initialize server middleware
 */
function initializeMiddleware() {
  // Basic Express middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

  // Webhook routes
  app.get("/webhook/test", testWebhookGet);
  app.post("/webhook/test", testWebhookPost);
  app.post("/webhook/verify", verifyWebhookToken);
  app.post("/webhook/kofi", handleKoFiWebhook);

  // API routes
  app.get("/api/status", apiStatus);
  app.get("/api/info", apiInfo);
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
 * @returns {import('http').Server} The HTTP server instance
 * @throws {Error} If server fails to start
 */
export function startWebhookServer() {
  try {
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      const errorMessage = `Configuration validation failed: ${configValidation.errors.join(", ")}`;
      logger.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Initialize server components
    initializeMiddleware();
    initializeRoutes();
    initializeErrorHandling();

    // Start server
    const server = app.listen(serverConfig.port, () => {
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

      logger.info(`  Test: http://localhost:${serverConfig.port}/webhook/test`);
      logger.info(
        `  Verify: http://localhost:${serverConfig.port}/webhook/verify`,
      );
      logger.info(
        `  Ko-fi: http://localhost:${serverConfig.port}/webhook/kofi`,
      );
      logger.info(
        `  API Status: http://localhost:${serverConfig.port}/api/status`,
      );
      logger.info(`  API Info: http://localhost:${serverConfig.port}/api/info`);
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

export default app;
