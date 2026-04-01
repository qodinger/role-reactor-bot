import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Middleware to verify user can only access their own data
 * Must be used AFTER requireAuth middleware (req.user must be set)
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireOwnUser(req, res, next) {
  const { userId } = req.params;

  if (!userId) {
    logger.warn("User ID not provided in request", {
      path: req.path,
      method: req.method,
    });
    const { response } = createErrorResponse(
      "User ID is required",
      400,
      "The user ID parameter is missing from the request",
    );
    return res.status(400).json(response);
  }

  // User must be authenticated first
  if (!req.user || !req.user.id) {
    logger.warn("Unauthorized access attempt to user data", {
      userId,
      path: req.path,
      method: req.method,
      hasUser: !!req.user,
    });
    const { response } = createErrorResponse(
      "Authentication required",
      401,
      "Please log in to access this resource",
    );
    return res.status(401).json(response);
  }

  // Users can only access their own data unless they're an admin
  const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
  const isOwnData = req.user.id === userId;

  if (!isOwnData && !isAdmin) {
    logger.warn("Forbidden access attempt to another user's data", {
      authenticatedUserId: req.user.id,
      requestedUserId: userId,
      path: req.path,
      method: req.method,
    });
    const { response } = createErrorResponse(
      "Insufficient permissions",
      403,
      "You can only access your own user data",
    );
    return res.status(403).json(response);
  }

  // Attach authorization info to request
  req.isOwnData = isOwnData;
  req.isAdmin = isAdmin;
  next();
}

/**
 * Middleware to verify user is an admin
 * Must be used AFTER requireAuth middleware (req.user must be set)
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireAdmin(req, res, next) {
  // User must be authenticated first
  if (!req.user || !req.user.id) {
    logger.warn("Unauthorized access attempt to admin endpoint", {
      path: req.path,
      method: req.method,
      hasUser: !!req.user,
    });
    const { response } = createErrorResponse(
      "Authentication required",
      401,
      "Please log in to access this resource",
    );
    return res.status(401).json(response);
  }

  const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

  if (!isAdmin) {
    logger.warn("Forbidden access attempt to admin endpoint", {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      method: req.method,
    });
    const { response } = createErrorResponse(
      "Admin access required",
      403,
      "This endpoint requires administrator privileges",
    );
    return res.status(403).json(response);
  }

  next();
}
