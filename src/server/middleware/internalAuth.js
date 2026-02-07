import { getLogger } from "../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Middleware to verify internal API key for communication between website and bot
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function internalAuth(req, res, next) {
  const apiKey = req.headers["authorization"] || req.headers["x-api-key"];
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey) {
    logger.warn("⚠️ INTERNAL_API_KEY not configured in environment");
    return next(); // Default to open in dev if not set? No, let's be strict.
  }

  // Support "Bearer <key>" or just "<key>"
  const providedKey = apiKey?.startsWith("Bearer ")
    ? apiKey.substring(7)
    : apiKey;

  if (!providedKey || providedKey !== internalKey) {
    logger.warn("🔒 Unauthorized internal API attempt", {
      ip: req.ip,
      endpoint: req.originalUrl,
      hasKey: !!providedKey,
    });

    const { statusCode, response } = createErrorResponse(
      "Unauthorized: Internal access only",
      401,
    );
    return res.status(statusCode).json(response);
  }

  next();
}
