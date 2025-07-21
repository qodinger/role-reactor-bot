import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

/**
 * Gets the role mapping for a specific message.
 * @param {string} messageId The ID of the message.
 * @returns {Promise<object|null>} The role mapping, or null if not found.
 */
export async function getRoleMapping(messageId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const mappings = await storageManager.getRoleMappings();
    return mappings[messageId] || null;
  } catch (error) {
    logger.error("Failed to get role mapping", error);
    return null;
  }
}

/**
 * Gets all role mappings.
 * @returns {Promise<object>} All role mappings.
 */
export async function getAllRoleMappings() {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.getRoleMappings();
  } catch (error) {
    logger.error("Failed to get all role mappings", error);
    return {};
  }
}

/**
 * Sets the role mapping for a message.
 * @param {string} messageId The ID of the message.
 * @param {string} guildId The ID of the guild.
 * @param {string} channelId The ID of the channel.
 * @param {object} roles The roles to map.
 * @returns {Promise<boolean>} True if the mapping was set successfully.
 */
export async function setRoleMapping(messageId, guildId, channelId, roles) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.setRoleMapping(
      messageId,
      guildId,
      channelId,
      roles,
    );
  } catch (error) {
    logger.error("Failed to set role mapping", error);
    return false;
  }
}

/**
 * Removes the role mapping for a message.
 * @param {string} messageId The ID of the message.
 * @returns {Promise<boolean>} True if the mapping was removed successfully.
 */
export async function removeRoleMapping(messageId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.deleteRoleMapping(messageId);
  } catch (error) {
    logger.error("Failed to remove role mapping", error);
    return false;
  }
}
