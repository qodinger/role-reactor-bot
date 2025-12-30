/**
 * Authentication middleware
 * Provides authentication utilities for protected routes
 */

import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Require authentication middleware
 * Checks if user is authenticated via session
 * @returns {Function} Express middleware
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.discordUser) {
    logger.debug("Authentication failed", {
      path: req.path,
      method: req.method,
      hasSession: !!req.session,
    });
    const { response } = createErrorResponse(
      "Authentication required",
      401,
      "Please log in to access this resource",
    );
    return res.status(401).json(response);
  }

  // Attach user info to request
  req.user = req.session.discordUser;
  next();
}

/**
 * Optional authentication middleware
 * Attaches user info if authenticated, but doesn't require it
 * @returns {Function} Express middleware
 */
export function optionalAuth(req, res, next) {
  if (req.session && req.session.discordUser) {
    req.user = req.session.discordUser;
  }
  next();
}

/**
 * Require specific user role/permission
 * @param {Function} checkPermission - Function to check permission (userId, permission) => boolean
 * @returns {Function} Express middleware
 */
export function requirePermission(checkPermission) {
  return (req, res, next) => {
    if (!req.user) {
      logger.debug("Permission check failed: user not authenticated", {
        path: req.path,
        method: req.method,
      });
      const { response } = createErrorResponse(
        "Authentication required",
        401,
        "Please log in to access this resource",
      );
      return res.status(401).json(response);
    }

    const hasPermission = checkPermission(req.user.id, req.path);

    if (!hasPermission) {
      logger.debug("Permission check failed: insufficient permissions", {
        userId: req.user.id,
        path: req.path,
        method: req.method,
      });
      const { response } = createErrorResponse(
        "Insufficient permissions",
        403,
        "You don't have permission to access this resource",
      );
      return res.status(403).json(response);
    }

    next();
  };
}
