/**
 * Request ID Middleware
 * Adds a unique request ID to each request for tracing and debugging
 */

/**
 * Generate a unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request and response header
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requestIdMiddleware(req, res, next) {
  // Use existing request ID from header, or generate a new one
  req.requestId = req.headers["x-request-id"] || generateRequestId();

  // Set response header for client tracking
  res.setHeader("X-Request-ID", req.requestId);

  next();
}

