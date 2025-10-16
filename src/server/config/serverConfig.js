/**
 * @fileoverview Server configuration for the unified API server
 *
 * Centralizes server configuration and environment variable handling.
 *
 * @author Tyecode
 * @version 1.0.0
 * @license MIT
 */

/**
 * Server configuration object
 */
export const serverConfig = {
  // Port configuration
  port: process.env.API_PORT || 3030,

  // Environment configuration
  environment: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  },

  // Request logging configuration
  logging: {
    enabled: process.env.REQUEST_LOGGING !== "false",
    level: process.env.LOG_LEVEL || "info",
  },

  // Health check configuration
  health: {
    enabled: process.env.HEALTH_CHECKS !== "false",
    dockerCheck: process.env.DOCKER_HEALTH_CHECK !== "false",
  },

  // Webhook configuration
  webhook: {
    token: process.env.KOFI_WEBHOOK_TOKEN,
    verificationEnabled: process.env.WEBHOOK_VERIFICATION !== "false",
  },

  // Server metadata
  metadata: {
    name: "Role Reactor Bot API Server",
    version: "1.0.0",
    description: "Unified API server for Role Reactor Discord Bot",
  },
};

/**
 * Validate server configuration
 * @returns {Object} Validation result with isValid and errors
 */
export function validateConfig() {
  const errors = [];

  // Check required environment variables
  if (!process.env.DISCORD_TOKEN) {
    errors.push("DISCORD_TOKEN is required");
  }

  // Check port validity
  const port = parseInt(serverConfig.port);
  if (isNaN(port) || port < 1024 || port > 65535) {
    errors.push("Port must be a number between 1024 and 65535");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get server startup information
 * @returns {Object} Server startup information
 */
export function getStartupInfo() {
  return {
    port: serverConfig.port,
    environment: serverConfig.environment,
    isDevelopment: serverConfig.isDevelopment,
    isProduction: serverConfig.isProduction,
    corsEnabled: true,
    loggingEnabled: serverConfig.logging.enabled,
    healthChecksEnabled: serverConfig.health.enabled,
    webhookVerificationEnabled: serverConfig.webhook.verificationEnabled,
  };
}
