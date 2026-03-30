import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

// Import API metrics recorder from HealthController
let recordRequest = () => {};
try {
  const { recordRequest: rr } = await import(
    "../controllers/HealthController.js"
  );
  recordRequest = rr;
} catch (_e) {
  // HealthController might not be loaded yet
}

/**
 * Request logging middleware
 * @param {import('../types.js').ExtendedRequest} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = req.requestId || "unknown";

  // Skip logging for logs endpoint to avoid infinite loop of "watching the watcher"
  if (req.url.includes("/api/v1/logs")) {
    next();
    return;
  }

  // Log request details
  logger.debug("📥 Incoming request", {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response details
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;

    logger.debug("📤 Response sent", {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Record API metrics
    recordRequest(duration);

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}
