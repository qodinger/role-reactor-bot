import { getLogger } from "../../../utils/logger.js";
import {
  removeTemporaryRole,
  getUserTemporaryRoles,
} from "../../../utils/discord/temporaryRoles.js";

/**
 * Validate if a role is a temporary role for a user
 * @param {Object} roleData
 * @returns {Promise<boolean>}
 */
export async function validateTemporaryRole(roleData) {
  const logger = getLogger();

  try {
    const tempRoles = await getUserTemporaryRoles(
      roleData.guildId,
      roleData.userId,
    );
    const tempRole = tempRoles.find(tr => tr.roleId === roleData.roleId);

    if (!tempRole) {
      return false;
    }

    // Check if the role has expired
    const now = new Date();
    const expiresAt = new Date(tempRole.expiresAt);
    if (expiresAt < now) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating temporary role", error);
    return false;
  }
}

/**
 * Remove role from user
 * @param {import('discord.js').GuildMember} member
 * @param {string} roleId
 * @returns {Promise<boolean>}
 */
export async function removeRoleFromUser(member, roleId) {
  const logger = getLogger();

  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
      return false;
    }

    if (!member.roles.cache.has(roleId)) {
      return false;
    }

    await member.roles.remove(role);
    return true;
  } catch (error) {
    logger.error("Error removing role from user", error);
    return false;
  }
}

/**
 * Remove temporary role data
 * @param {Object} roleData
 * @returns {Promise<boolean>}
 */
export async function removeTemporaryRoleData(roleData) {
  const logger = getLogger();

  try {
    await removeTemporaryRole(
      roleData.guildId,
      roleData.userId,
      roleData.roleId,
    );
    return true;
  } catch (error) {
    logger.error("Error removing temporary role data", error);
    return false;
  }
}

/**
 * Log temporary role removal
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {string} reason
 */
export function logTempRoleRemoval(guildId, userId, roleId, reason) {
  const logger = getLogger();
  logger.info(
    `Temporary role removed - Guild: ${guildId}, User: ${userId}, Role: ${roleId}, Reason: ${reason}`,
  );
}
