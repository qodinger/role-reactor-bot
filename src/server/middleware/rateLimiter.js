import rateLimit from "express-rate-limit";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Create a rate limiter for webhook endpoints
 * Configurable via environment variables
 */
export const webhookRateLimiter = rateLimit({
  windowMs:
    parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100, // 100 requests per window default
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
 * Create a strict rate limiter for Ko-fi webhook endpoint
 * More restrictive than general webhook limiter
 */
export const kofiWebhookRateLimiter = rateLimit({
  windowMs:
    parseInt(process.env.KOFI_WEBHOOK_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.KOFI_WEBHOOK_RATE_LIMIT_MAX) || 50, // 50 requests per window default
  message: {
    status: "error",
    message: "Too many Ko-fi webhook requests, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("⚠️ Rate limit exceeded for Ko-fi webhook endpoint", {
      ip: req.ip,
      url: req.url,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      status: "error",
      message: "Too many Ko-fi webhook requests, please try again later",
      retryAfter: "15 minutes",
    });
  },
});
