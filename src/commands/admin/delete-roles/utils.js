import { getLogger } from "../../../utils/logger.js";

/**
 * Validate that a message ID is in the correct Discord format
 * @param {string} messageId
 * @returns {boolean}
 */
export function validateMessageId(messageId) {
  return /^\d{17,19}$/.test(messageId);
}

/**
 * Validate that a role mapping exists and is valid
 * @param {Object} roleMapping
 * @returns {boolean}
 */
export function validateRoleMapping(roleMapping) {
  return roleMapping && typeof roleMapping === "object";
}

/**
 * Validate that a message exists in a channel
 * @param {import('discord.js').TextChannel} channel
 * @param {string} messageId
 * @returns {Promise<import('discord.js').Message|null>}
 */
export async function validateMessage(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    return message;
  } catch {
    return null;
  }
}

/**
 * Extract role IDs from message reactions
 * @param {import('discord.js').Message} message
 * @returns {Array}
 */
export function extractRolesFromReactions(message) {
  const roles = [];
  if (!message.reactions || !message.reactions.cache) {
    return roles;
  }

  for (const reaction of message.reactions.cache.values()) {
    if (reaction.emoji && reaction.emoji.id) {
      // This is a custom emoji, we'd need to map it to a role
      // For now, just return empty array as this is a mock
      continue;
    }
  }

  return roles;
}

/**
 * Delete multiple roles from a guild
 * @param {import('discord.js').Guild} guild
 * @param {Array<string>} roleIds
 * @returns {Promise<Object>}
 */
export async function deleteRoles(guild, roleIds) {
  const result = { success: 0, failed: 0 };

  for (const roleId of roleIds) {
    try {
      const role = guild.roles.cache.get(roleId);
      if (role && validateRoleForDeletion(role)) {
        await role.delete();
        result.success++;
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
    }
  }

  return result;
}

/**
 * Validate if a role can be deleted
 * @param {import('discord.js').Role} role
 * @returns {boolean}
 */
export function validateRoleForDeletion(role) {
  // Don't delete managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return false;
  }

  // Don't delete bot roles
  if (role.tags && role.tags.botId) {
    return false;
  }

  // Don't delete roles that are too high in the hierarchy
  // This is a simplified check - in reality you'd check against the bot's highest role
  if (role.position >= 100) {
    return false;
  }

  return true;
}

/**
 * Log role deletion activity
 * @param {string} guildId
 * @param {string} userId
 * @param {string} messageId
 * @param {number} rolesRemoved
 */
export function logRoleDeletionActivity(
  guildId,
  userId,
  messageId,
  rolesRemoved,
) {
  const logger = getLogger();
  logger.info(
    `Role deletion - Guild: ${guildId}, User: ${userId}, Message: ${messageId}, Roles: ${rolesRemoved}`,
  );
}
