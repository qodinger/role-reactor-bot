import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Request logging middleware
 * @param {import('express').Request} req - Express request object
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

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
}
