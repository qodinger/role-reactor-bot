/**
 * @fileoverview Server module exports
 *
 * Provides clean exports for all server-related functionality.
 *
 * @author Tyecode
 * @version 1.0.0
 * @license MIT
 */

// Main server functions
export {
  startWebhookServer,
  getApp,
  getServerConfig,
} from "./webhookServer.js";

// Configuration
export {
  serverConfig,
  validateConfig,
  getStartupInfo,
} from "./config/serverConfig.js";

// Middleware
export { corsMiddleware } from "./middleware/cors.js";
export { requestLogger } from "./middleware/requestLogger.js";
export { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Route handlers
export { healthCheck, dockerHealthCheck } from "./routes/health.js";
export {
  testWebhookGet,
  testWebhookPost,
  verifyWebhookToken,
} from "./routes/webhook.js";
export { apiStatus, apiInfo } from "./routes/api.js";
