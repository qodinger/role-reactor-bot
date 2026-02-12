// Main server functions
export {
  startWebhookServer,
  getApp,
  getServerConfig,
  setClient,
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
export { verifyWebhookToken } from "./routes/webhook.js";
export { apiInfo } from "./routes/api.js";
export { apiStats, apiCommandUsage } from "./controllers/StatsController.js";
export { getServices, getService } from "./routes/services.js";

// Services
export {
  ServiceRegistry,
  serviceRegistry,
  BaseService,
} from "./services/index.js";
export {
  loadService,
  loadServices,
  autoLoadServices,
} from "./utils/serviceLoader.js";

// Middleware
export {
  validateBody,
  validateQuery,
  validateParams,
} from "./middleware/validation.js";
export {
  requireAuth,
  optionalAuth,
  requirePermission,
} from "./middleware/authentication.js";
