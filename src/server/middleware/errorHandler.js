import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Error handling middleware
 * @param {Error} error - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} _next - Express next function (unused)
 */
export function errorHandler(error, req, res, _next) {
  logger.error("❌ API server error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    status: "error",
    message: "Internal server error",
    ...(isDevelopment && {
      error: error.message,
      stack: error.stack,
    }),
    timestamp: new Date().toISOString(),
  });
}

/**
 * 404 Not Found handler
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function notFoundHandler(req, res) {
  logger.warn("🔍 404 Not Found", {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.status(404).json({
    status: "error",
    message: "Endpoint not found",
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}
