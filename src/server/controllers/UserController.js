import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * List all users with pagination
 */
export async function apiListUsers(req, res) {
  logRequest(logger, "List users", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { discordId: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { globalName: { $regex: search, $options: "i" } },
      ];
    }

    const users = await storage.dbManager.users.listUsers(filter, limit, skip);
    const total = await storage.dbManager.users.count(filter);

    return res.json(
      createSuccessResponse({
        users: users.map(u => ({
          id: u.discordId,
          username: u.username,
          globalName: u.globalName,
          avatar: u.avatar,
          role: u.role || "user",
          lastLogin: u.lastLogin,
          createdAt: u.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        message: "Users retrieved successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to list users", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Get detailed user info
 */
export async function apiUserInfo(req, res) {
  logRequest(logger, "User info", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const { userId } = req.params;
    const user = await storage.dbManager.users.findByDiscordId(userId);

    if (!user) {
      const { statusCode, response } = createErrorResponse(
        "User not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    return res.json(
      createSuccessResponse({
        id: user.discordId,
        username: user.username,
        globalName: user.globalName,
        avatar: user.avatar,
        email: user.email,
        role: user.role || "user",
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        message: "User info retrieved",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to get user info", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Update user role
 */
export async function apiSetUserRole(req, res) {
  logRequest(logger, "Set user role", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      const { statusCode, response } = createErrorResponse(
        "Role is required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const success = await storage.dbManager.users.setRole(userId, role);

    if (!success) {
      const { statusCode, response } = createErrorResponse(
        "Failed to update role or user not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    logger.info(`✅ User role updated: ${userId} -> ${role}`);
    return res.json(
      createSuccessResponse({
        userId,
        role,
        message: "Role updated successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to set user role", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Sync user data from Discord OAuth (called by website)
 */
export async function apiSyncUser(req, res) {
  logRequest(logger, "Sync user", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const {
      id,
      username,
      discriminator,
      globalName,
      avatar,
      email,
      accessToken,
      refreshToken,
    } = req.body;

    if (!id) {
      const { statusCode, response } = createErrorResponse(
        "Discord ID is required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const user = await storage.dbManager.users.upsertFromDiscordOAuth({
      discordId: id,
      username,
      discriminator,
      globalName,
      avatar,
      email,
      accessToken,
      refreshToken,
    });

    return res.json(
      createSuccessResponse({
        id: user.discordId,
        role: user.role || "user",
        message: "User synced successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to sync user", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}
