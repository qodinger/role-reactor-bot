import net from "net";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    token: process.env.WEBHOOK_TOKEN,
    verificationEnabled: process.env.WEBHOOK_VERIFICATION !== "false",
  },

  // Server metadata
  metadata: {
    name: "Role Reactor Bot API Server",
    version: "1.0.0",
    description: "Unified API server for Role Reactor Discord Bot",
    apiPrefix: "/api/v1",
  },
};

/**
 * Check if a port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available, false otherwise
 */
export async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.listen(port, () => {
      server.once("close", () => {
        resolve(true);
      });
      server.close();
    });

    server.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port starting from the configured port
 * @param {number} startPort - Starting port number
 * @param {number} maxAttempts - Maximum number of ports to try
 * @returns {Promise<number|null>} Available port number or null if none found
 */
export async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);

    if (available) {
      logger.debug(`✅ Port ${port} is available`);
      return port;
    } else {
      logger.debug(`❌ Port ${port} is in use`);
    }
  }

  logger.error(
    `❌ No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`,
  );
  return null;
}

/**
 * Check port availability and suggest alternatives
 * @param {number} port - Port to check
 * @returns {Promise<Object>} Port check result with suggestions
 */
export async function checkPortAvailability(port) {
  const available = await isPortAvailable(port);

  if (available) {
    return {
      available: true,
      port,
      message: `✅ Port ${port} is available`,
    };
  }

  // Find alternative ports
  const alternatives = [];
  for (let i = 1; i <= 5; i++) {
    const altPort = port + i;
    if (await isPortAvailable(altPort)) {
      alternatives.push(altPort);
    }
  }

  return {
    available: false,
    port,
    alternatives,
    message: `❌ Port ${port} is already in use`,
    suggestion:
      alternatives.length > 0
        ? `💡 Try these available ports: ${alternatives.join(", ")}`
        : `💡 Set a different port with API_PORT environment variable`,
  };
}

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
  const port = parseInt(serverConfig.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push("Port must be a number between 1 and 65535");
  }
  if (port < 1024 && serverConfig.isProduction) {
    logger.warn(
      "⚠️ Ports below 1024 require root privileges. Consider using a port >= 1024 in production.",
    );
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
