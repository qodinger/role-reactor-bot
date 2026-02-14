import rateLimit from "express-rate-limit";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Create a rate limiter for webhook endpoints
 * Configurable via environment variables
 */
export const webhookRateLimiter = rateLimit({
  windowMs:
    parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes default
  max: (() => {
    const envValue = process.env.WEBHOOK_RATE_LIMIT_MAX;
    if (!envValue) {
      return 100; // Default, no warning needed
    }
    const max = parseInt(envValue, 10);
    if (isNaN(max) || max < 1) {
      logger.warn("Invalid WEBHOOK_RATE_LIMIT_MAX, using default: 100");
      return 100;
    }
    return max;
  })(),
  message: {
    status: "error",
    message: "Too many webhook requests, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn("⚠️ Rate limit exceeded for webhook endpoint", {
      ip: req.ip,
      url: req.url,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      status: "error",
      message: "Too many webhook requests, please try again later",
      retryAfter: "15 minutes",
    });
  },
  skip: req => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path.startsWith("/health/");
  },
});

/**
 * Create a rate limiter for API endpoints
 * More lenient than webhook limiters for public API access
 */
export const apiRateLimiter = rateLimit({
  windowMs:
    parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes default
  max: (() => {
    const envValue = process.env.API_RATE_LIMIT_MAX;
    if (!envValue) {
      return 60; // Default, no warning needed
    }
    const max = parseInt(envValue, 10);
    if (isNaN(max) || max < 1) {
      logger.warn("Invalid API_RATE_LIMIT_MAX, using default: 60");
      return 60;
    }
    return max;
  })(),
  message: {
    status: "error",
    message: "Too many API requests, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("⚠️ Rate limit exceeded for API endpoint", {
      ip: req.ip,
      url: req.url,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      status: "error",
      message: "Too many API requests, please try again later",
      retryAfter: "15 minutes",
    });
  },
  skip: req => {
    // Skip rate limiting for health checks
    if (req.path === "/health" || req.path.startsWith("/health/")) {
      return true;
    }

    // Skip if internal API key is provided and matches
    const apiKey = req.headers["authorization"] || req.headers["x-api-key"];
    const internalKey = process.env.INTERNAL_API_KEY;

    if (apiKey && internalKey) {
      const providedKey = apiKey.startsWith("Bearer ")
        ? apiKey.substring(7)
        : apiKey;

      // Use timing-safe comparison logic if possible, or direct string compare
      // For now, direct compare is fine for rate limiter skip logic
      if (providedKey === internalKey) {
        return true;
      } else {
        // Debug logging for mismatched keys (only in dev/debug mode ideally, but useful here)
        // logger.debug(`Rate limit skip failed: Valid key provided? ${!!providedKey}, Match? ${providedKey === internalKey}`);
      }
    }

    // Fallback: Check for localhost or specific trusted IPs if key auth fails?
    // No, key auth should be sufficient.

    return false;
  },
});
