import { getLogger } from "../../../utils/logger.js";
import { parseDuration } from "../../../utils/discord/temporaryRoles.js";

/**
 * Validate if a role can be assigned
 * @param {import('discord.js').Role} role
 * @returns {boolean}
 */
export function validateRole(role) {
  // Don't assign managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return false;
  }

  // Don't assign bot roles
  if (role.tags && role.tags.botId) {
    return false;
  }

  return true;
}

/**
 * Validate duration string
 * @param {string} durationStr
 * @returns {boolean}
 */
export function validateDuration(durationStr) {
  try {
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return false;
    }

    const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const minDurationMs = 1 * 60 * 1000; // 1 minute in milliseconds

    // Check if duration is too long (more than 1 year)
    if (durationMs > maxDurationMs) {
      return false;
    }

    // Check if duration is too short (less than 1 minute)
    if (durationMs < minDurationMs) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Process user list string into array of user IDs
 * @param {string} usersString
 * @returns {Array<string>}
 */
export function processUserList(usersString) {
  if (!usersString) return [];

  const userList = usersString
    .split(",")
    .map(user => user.trim())
    .filter(user => user.length > 0);

  const userIds = [];

  for (const user of userList) {
    let userId = null;

    // Check if it's a mention (<@123456789>)
    const mentionMatch = user.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      userId = mentionMatch[1];
    }
    // Check if it's a plain user ID
    else if (/^\d{17,19}$/.test(user)) {
      userId = user;
    }

    if (userId && !userIds.includes(userId)) {
      userIds.push(userId);
    }
  }

  return userIds;
}

/**
 * Delay function for rate limiting
 * @param {number} ms
 * @returns {Promise}
 */
export function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Log temporary role assignment
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} expiresAt
 * @param {string} reason
 */
export function logTempRoleAssignment(
  guildId,
  userId,
  roleId,
  expiresAt,
  reason,
) {
  const logger = getLogger();
  logger.info(
    `Temporary role assigned - Guild: ${guildId}, User: ${userId}, Role: ${roleId}, Expires: ${expiresAt.toISOString()}, Reason: ${reason}`,
  );
}
