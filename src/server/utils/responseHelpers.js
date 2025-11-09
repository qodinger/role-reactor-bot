/**
 * Response helper utilities for API and webhook routes
 */

/**
 * Create success response
 * @param {Object} data - Response data
 * @returns {Object} Formatted response
 */
export function createSuccessResponse(data) {
  return {
    status: "success",
    ...data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} [hint] - Helpful hint
 * @param {string} [error] - Error details
 * @returns {Object} Formatted error response with statusCode
 */
export function createErrorResponse(
  message,
  statusCode = 500,
  hint = null,
  error = null,
) {
  const response = {
    status: "error",
    message,
    timestamp: new Date().toISOString(),
  };

  if (hint) {
    response.hint = hint;
  }

  if (error) {
    response.error = error;
  }

  return { statusCode, response };
}

/**
 * Log request
 * @param {import('../../utils/logger.js').Logger} logger - Logger instance
 * @param {string} endpoint - Endpoint name
 * @param {import('express').Request} req - Express request object
 * @param {string} [emoji] - Emoji for log message
 */
export function logRequest(logger, endpoint, req, emoji = "📊") {
  logger.debug(`${emoji} ${endpoint} requested`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
}
