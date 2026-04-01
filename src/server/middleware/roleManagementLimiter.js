import rateLimit from "express-rate-limit";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Strict rate limiter for role management operations
 * Prevents abuse of role-reaction and role assignment features
 */
export const roleManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 role management operations per 15 minutes
  message: {
    status: "error",
    message: "Too many role management operations, please try again later",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    // Use user ID from session if available, otherwise IP
    return req.user?.id || req.ip || "unknown";
  },
  handler: (req, _res) => {
    logger.warn("Rate limit exceeded for role management", {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  },
});

/**
 * Rate limiter for guild settings modifications
 * More restrictive than general API calls
 */
export const guildSettingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 settings modifications per 15 minutes
  message: {
    status: "error",
    message: "Too many settings modifications, please try again later",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    return req.user?.id || req.ip || "unknown";
  },
  handler: (req, _res) => {
    logger.warn("Rate limit exceeded for guild settings", {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  },
});

/**
 * Rate limiter for custom command operations
 */
export const customCommandLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 custom command operations per 15 minutes
  message: {
    status: "error",
    message: "Too many custom command operations, please try again later",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    return req.user?.id || req.ip || "unknown";
  },
  handler: (req, _res) => {
    logger.warn("Rate limit exceeded for custom commands", {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  },
});

/**
 * Rate limiter for premium feature activation
 * Very restrictive to prevent abuse
 */
export const premiumActivationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each user to 5 premium activations per hour
  message: {
    status: "error",
    message: "Too many premium feature activations, please try again later",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    return req.user?.id || req.ip || "unknown";
  },
  handler: (req, _res) => {
    logger.warn("Rate limit exceeded for premium activation", {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  },
});
