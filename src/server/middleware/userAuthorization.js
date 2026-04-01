import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Middleware to verify user can only access their own data
 * Checks URL param userId against req.user.id (set from X-User-ID header or session)
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireOwnUser(req, res, next) {
  // Get userId from URL params (e.g., /user/:userId/balance)
  const { userId } = req.params;

  // For endpoints without URL param (like /sync), use req.user.id directly
  // But still require authentication
  if (!userId) {
    // Check if req.user is set from X-User-ID header
    if (req.user && req.user.id) {
      return next();
    }
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
  const isAdmin =
    req.user.role === "admin" ||
    req.user.role === "superadmin" ||
    req.user.role === "owner";
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
 * Supports both session-based auth (browser) and internal API (X-User-ID header)
 * Fetches user role from database if not already set on req.user
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export async function requireAdmin(req, res, next) {
  // User must be authenticated first (either via session or X-User-ID header)
  // req.user is set by either requireAuth (session) or internalAuth (X-User-ID)
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

  // If role is already set (from session), check directly
  if (req.user.role) {
    const userRole = req.user.role;
    const isAdmin =
      userRole === "admin" || userRole === "superadmin" || userRole === "owner";

    if (!isAdmin) {
      logger.warn("Forbidden access attempt to admin endpoint", {
        userId: req.user.id,
        role: userRole,
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
    return next();
  }

  // For internal API calls, fetch user from database to get role
  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const user = await storage.dbManager.users.findByDiscordId(req.user.id);

    if (!user) {
      logger.warn("User not found in database", {
        userId: req.user.id,
        path: req.path,
      });
      const { response } = createErrorResponse(
        "User not found",
        404,
        "User does not exist in the system",
      );
      return res.status(404).json(response);
    }

    const userRole = user.role || "user";
    const isAdmin =
      userRole === "admin" || userRole === "superadmin" || userRole === "owner";

    if (!isAdmin) {
      logger.warn("Forbidden access attempt to admin endpoint", {
        userId: req.user.id,
        role: userRole,
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

    // Attach role to req.user for downstream use
    req.user.role = userRole;
    req.isAdmin = true;
    next();
  } catch (error) {
    logger.error("Error checking admin status:", error);
    const { response } = createErrorResponse(
      "Internal Server Error",
      500,
      "Failed to verify admin privileges",
    );
    return res.status(500).json(response);
  }
}
