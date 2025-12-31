import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Error handling middleware
 * @param {Error} error - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} _next - Express next function (unused)
 */
export function errorHandler(error, req, res, _next) {
  const requestId = req.requestId || "unknown";
  logger.error("❌ API server error:", {
    requestId,
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

  const { statusCode, response } = createErrorResponse(
    "Internal server error",
    500,
    isDevelopment ? error.message : null,
    isDevelopment ? error.stack : null,
  );

  res.status(statusCode).json({
    ...response,
    requestId,
  });
}

/**
 * 404 Not Found handler
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function notFoundHandler(req, res) {
  const requestId = req.requestId || "unknown";
  logger.warn("🔍 404 Not Found", {
    requestId,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  const { statusCode, response } = createErrorResponse(
    "Endpoint not found",
    404,
    `The requested endpoint ${req.method} ${req.url} does not exist`,
  );

  res.status(statusCode).json({
    ...response,
    requestId,
    url: req.url,
    method: req.method,
  });
}
