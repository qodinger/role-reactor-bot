import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Middleware to verify user has permission to manage roles in a guild
 * Must be used AFTER requireAuth middleware (req.user must be set)
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireGuildPermission(req, res, next) {
  const { guildId } = req.params;

  if (!guildId) {
    logger.warn("Guild ID not provided in request", {
      path: req.path,
      method: req.method,
    });
    const { response } = createErrorResponse(
      "Guild ID is required",
      400,
      "The guild ID parameter is missing from the request",
    );
    return res.status(400).json(response);
  }

  // User must be authenticated first
  if (!req.user || !req.user.id) {
    logger.warn("Unauthorized access attempt to guild management", {
      guildId,
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

  // Check if user has permission in the guild
  checkUserGuildPermission(req.user.id, guildId)
    .then(hasPermission => {
      if (!hasPermission) {
        logger.warn("Forbidden access attempt to guild management", {
          userId: req.user.id,
          guildId,
          path: req.path,
          method: req.method,
        });
        const { response } = createErrorResponse(
          "Insufficient permissions",
          403,
          "You don't have permission to manage roles in this server",
        );
        return res.status(403).json(response);
      }

      // Attach guild info to request for downstream handlers
      req.guildId = guildId;
      next();
    })
    .catch(error => {
      logger.error("Error checking guild permission", {
        userId: req.user.id,
        guildId,
        error: error.message,
      });
      const { response } = createErrorResponse(
        "Failed to verify permissions",
        500,
        error.message,
      );
      res.status(500).json(response);
    });
}

/**
 * Check if a user has permission to manage roles in a guild
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} True if user has permission
 */
async function checkUserGuildPermission(userId, guildId) {
  const { getDiscordClient } = await import("../utils/apiShared.js");
  const client = getDiscordClient();

  if (!client) {
    logger.warn("Discord client not available for permission check");
    return false;
  }

  try {
    // Try to get guild from cache first
    let guild = client.guilds.cache.get(guildId);
    
    // If not in cache, try to fetch it
    if (!guild) {
      guild = await client.guilds.fetch(guildId).catch(() => null);
    }

    if (!guild) {
      logger.debug("Guild not found", { guildId });
      return false;
    }

    // Try to get member from cache
    let member = guild.members.cache.get(userId);
    
    // If not in cache, try to fetch the member
    if (!member) {
      member = await guild.members.fetch(userId).catch(() => null);
    }

    if (!member) {
      logger.debug("User not member of guild", { userId, guildId });
      return false;
    }

    // Check if user has Manage Roles permission
    // This is the key permission for managing role reactions
    const hasManageRoles = member.permissions.has("ManageRoles");
    
    // Also allow users with ManageGuild permission (admins)
    const hasManageGuild = member.permissions.has("ManageGuild");
    
    // Allow bot owners/admins (check via user ID)
    const isAdminUser = process.env.DISCORD_OWNER_ID && 
                        userId === process.env.DISCORD_OWNER_ID;

    const hasPermission = hasManageRoles || hasManageGuild || isAdminUser;

    if (hasPermission) {
      logger.debug("User has guild permission", {
        userId,
        guildId,
        hasManageRoles,
        hasManageGuild,
        isAdminUser,
      });
    } else {
      logger.debug("User lacks guild permission", {
        userId,
        guildId,
        hasManageRoles,
        hasManageGuild,
        isAdminUser,
      });
    }

    return hasPermission;
  } catch (error) {
    logger.error("Error checking guild permission", {
      userId,
      guildId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Middleware to check if user is a member of the guild (less strict than requireGuildPermission)
 * Can be used for read-only operations
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireGuildMembership(req, res, next) {
  const { guildId } = req.params;

  if (!guildId) {
    const { response } = createErrorResponse(
      "Guild ID is required",
      400,
      "The guild ID parameter is missing from the request",
    );
    return res.status(400).json(response);
  }

  if (!req.user || !req.user.id) {
    const { response } = createErrorResponse(
      "Authentication required",
      401,
      "Please log in to access this resource",
    );
    return res.status(401).json(response);
  }

  checkUserGuildMembership(req.user.id, guildId)
    .then(isMember => {
      if (!isMember) {
        const { response } = createErrorResponse(
          "Guild membership required",
          403,
          "You must be a member of this server to access this resource",
        );
        return res.status(403).json(response);
      }

      req.guildId = guildId;
      next();
    })
    .catch(error => {
      logger.error("Error checking guild membership", {
        userId: req.user.id,
        guildId,
        error: error.message,
      });
      const { response } = createErrorResponse(
        "Failed to verify membership",
        500,
        error.message,
      );
      res.status(500).json(response);
    });
}

/**
 * Check if a user is a member of a guild
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} True if user is a member
 */
async function checkUserGuildMembership(userId, guildId) {
  const { getDiscordClient } = await import("../utils/apiShared.js");
  const client = getDiscordClient();

  if (!client) {
    return false;
  }

  try {
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
      guild = await client.guilds.fetch(guildId).catch(() => null);
    }

    if (!guild) {
      return false;
    }

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch(userId).catch(() => null);
    }

    return !!member;
  } catch (error) {
    logger.error("Error checking guild membership", {
      userId,
      guildId,
      error: error.message,
    });
    return false;
  }
}
