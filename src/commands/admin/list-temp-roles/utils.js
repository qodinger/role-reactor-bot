import { getLogger } from "../../../utils/logger.js";

/**
 * Calculate time remaining until a specific date
 * @param {Date} expiresAt
 * @returns {string}
 */
export function calculateTimeRemaining(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else {
    return "Less than a minute";
  }
}

/**
 * Get user information from guild
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserInfo(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    return {
      username: member.user.username,
      discriminator: member.user.discriminator,
      id: member.user.id,
    };
  } catch {
    return null;
  }
}

/**
 * Get role information from guild
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @returns {Promise<Object|null>}
 */
export async function getRoleInfo(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return null;
  }

  return {
    name: role.name,
    color: role.color,
    id: role.id,
    position: role.position,
  };
}

/**
 * Process temporary roles and filter out expired ones
 * @param {import('discord.js').Guild} guild
 * @param {Array} tempRoles
 * @returns {Promise<Array>}
 */
export async function processTempRoles(guild, tempRoles) {
  const processedRoles = [];
  const now = new Date();

  for (const tempRole of tempRoles) {
    const expiresAt = new Date(tempRole.expiresAt);

    // Skip expired roles
    if (expiresAt <= now) {
      continue;
    }

    const userInfo = await getUserInfo(guild, tempRole.userId);
    const roleInfo = await getRoleInfo(guild, tempRole.roleId);

    if (userInfo && roleInfo) {
      const timeRemaining = calculateTimeRemaining(tempRole.expiresAt);
      processedRoles.push({
        ...tempRole,
        userInfo,
        roleInfo,
        timeRemaining,
      });
    }
  }

  return processedRoles;
}

/**
 * Format role color for display
 * @param {number} color
 * @returns {string}
 */
export function formatRoleColor(color) {
  if (!color) return "No color";
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Log temporary roles listing activity
 * @param {string} guildId
 * @param {string} userId
 * @param {string} targetUserId
 * @param {number} count
 */
export function logTempRolesListing(guildId, userId, targetUserId, count) {
  const logger = getLogger();
  const action = targetUserId ? `for user ${targetUserId}` : "for all users";
  logger.info(
    `Temporary roles listed ${action} - Guild: ${guildId}, User: ${userId}, Found: ${count}`,
  );
}
