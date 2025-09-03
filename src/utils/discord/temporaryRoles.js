import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

/**
 * Adds a temporary role to a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} expiresAt
 * @param {import("discord.js").Client} [client] Discord client for role assignment
 * @param {boolean} [notifyExpiry] Whether to send DM when role expires
 * @returns {Promise<boolean>}
 */
export async function addTemporaryRole(
  guildId,
  userId,
  roleId,
  expiresAt,
  client = null,
  notifyExpiry = false,
) {
  const logger = getLogger();
  try {
    // First, try to assign the Discord role to the user
    try {
      // Get the guild and member
      const guild = client?.guilds?.cache?.get(guildId);
      if (!guild) {
        logger.error(
          `Guild ${guildId} not found for temporary role assignment`,
        );
        return false;
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        logger.error(`Member ${userId} not found in guild ${guildId}`);
        return false;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        logger.error(`Role ${roleId} not found in guild ${guildId}`);
        return false;
      }

      // Check if user already has the role
      if (member.roles.cache.has(roleId)) {
        logger.info(`User ${userId} already has role ${role.name}`);
        // Don't return early - still need to store in database
      }

      // Assign the role only if user doesn't already have it
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(
          role,
          `Temporary role assignment - expires at ${expiresAt.toISOString()}`,
        );
        logger.info(
          `✅ Successfully assigned temporary role ${role.name} to user ${userId}`,
        );
      } else {
        logger.info(
          `✅ User ${userId} already has role ${role.name}, skipping Discord assignment`,
        );
      }
    } catch (discordError) {
      logger.error(
        `Failed to assign Discord role to user ${userId}:`,
        discordError,
      );
      // If Discord assignment fails, don't store in database
      return false;
    }

    // Only store in database if Discord assignment succeeded
    const storageManager = await getStorageManager();
    const storageResult = await storageManager.addTemporaryRole(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );

    if (!storageResult) {
      logger.error(
        `Failed to store temporary role in database for user ${userId}`,
      );
      // If storage fails, we should remove the Discord role we just assigned
      try {
        const guild = client?.guilds?.cache?.get(guildId);
        if (guild) {
          const member = await guild.members.fetch(userId);
          const role = guild.roles.cache.get(roleId);
          if (member && role) {
            await member.roles.remove(
              role,
              "Failed to store temporary role in database",
            );
            logger.info(
              `Removed Discord role ${role.name} from user ${userId} due to storage failure`,
            );
          }
        }
      } catch (cleanupError) {
        logger.error(
          "Failed to cleanup Discord role after storage failure:",
          cleanupError,
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Failed to add temporary role", error);
    return false;
  }
}

/**
 * Adds a supporter role to a user (permanent supporter role).
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} assignedAt
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function addSupporter(
  guildId,
  userId,
  roleId,
  assignedAt,
  reason,
) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (!supporters[guildId]) {
      supporters[guildId] = {};
    }

    supporters[guildId][userId] = {
      roleId,
      assignedAt: assignedAt.toISOString(),
      reason,
      isActive: true,
    };

    await storageManager.setSupporters(supporters);
    logger.info(`Added supporter role for user ${userId} in guild ${guildId}`);
    return true;
  } catch (error) {
    logger.error("Failed to add supporter role", error);
    return false;
  }
}

/**
 * Removes a supporter role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function removeSupporter(guildId, userId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (supporters[guildId]?.[userId]) {
      delete supporters[guildId][userId];
      await storageManager.setSupporters(supporters);
      logger.info(
        `Removed supporter role for user ${userId} in guild ${guildId}`,
      );
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Failed to remove supporter role", error);
    return false;
  }
}

/**
 * Gets all supporters for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getSupporters(guildId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();
    const guildSupporters = supporters[guildId] || {};

    return Object.entries(guildSupporters).map(([userId, data]) => ({
      userId,
      roleId: data.roleId,
      assignedAt: new Date(data.assignedAt),
      reason: data.reason,
      isActive: data.isActive,
    }));
  } catch (error) {
    logger.error("Failed to get supporters", error);
    return [];
  }
}

/**
 * Removes a temporary role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @returns {Promise<boolean>}
 */
export async function removeTemporaryRole(guildId, userId, roleId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.removeTemporaryRole(guildId, userId, roleId);
  } catch (error) {
    logger.error("Failed to remove temporary role", error);
    return false;
  }
}

/**
 * Gets temporary roles for a specific user in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserTemporaryRoles(guildId, userId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    const userRoles = tempRoles[guildId]?.[userId] || {};

    // Convert to array format
    const rolesArray = [];
    for (const [roleId, roleData] of Object.entries(userRoles)) {
      rolesArray.push({
        guildId,
        userId,
        roleId,
        expiresAt: roleData.expiresAt,
        notifyExpiry: roleData.notifyExpiry || false,
      });
    }

    return rolesArray;
  } catch (error) {
    logger.error("Failed to get user temporary roles", error);
    return [];
  }
}

/**
 * Gets all temporary roles for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getTemporaryRoles(guildId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();

    const guildRoles = tempRoles[guildId] || {};

    // Convert to array format expected by the command
    const rolesArray = [];
    for (const [userId, userRoles] of Object.entries(guildRoles)) {
      for (const [roleId, roleData] of Object.entries(userRoles)) {
        rolesArray.push({
          guildId,
          userId,
          roleId,
          expiresAt: roleData.expiresAt,
          notifyExpiry: roleData.notifyExpiry || false,
        });
      }
    }

    return rolesArray;
  } catch (error) {
    logger.error("Failed to get temporary roles for guild", error);
    return [];
  }
}

/**
 * Parses a duration string (e.g., "1h30m") into milliseconds.
 * @param {string} durationStr
 * @returns {number|null}
 */
export function parseDuration(durationStr) {
  const regex = /(\d+)\s*(w|d|h|m)/g;
  let totalMs = 0;
  let match;
  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "w":
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
      case "d":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case "h":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "m":
        totalMs += value * 60 * 1000;
        break;
    }
  }
  return totalMs > 0 ? totalMs : null;
}

/**
 * Formats a duration string into a human-readable format.
 * @param {string} durationStr
 * @returns {string}
 */
export function formatDuration(durationStr) {
  const ms = parseDuration(durationStr);
  if (!ms) return "Invalid duration";

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/**
 * Formats the remaining time until a date.
 * @param {Date|string} expiresAt
 * @returns {string}
 */
export function formatRemainingTime(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  let remaining = "";
  if (days > 0) remaining += `${days}d `;
  if (hours > 0) remaining += `${hours}h `;
  if (minutes > 0) remaining += `${minutes}m`;
  return remaining.trim() || "Less than a minute";
}
