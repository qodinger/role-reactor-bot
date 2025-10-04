import { getLogger } from "../../../utils/logger.js";

/**
 * Validate XP settings data structure
 * @param {Object} xpSettings
 * @returns {boolean}
 */
export function validateXpSettings(xpSettings) {
  if (!xpSettings || typeof xpSettings !== "object") {
    return false;
  }

  const requiredFields = [
    "enabled",
    "messageXP",
    "commandXP",
    "roleXP",
    "messageXPAmount",
    "commandXPAmount",
    "roleXPAmount",
    "messageCooldown",
    "commandCooldown",
  ];

  return requiredFields.every(field =>
    Object.prototype.hasOwnProperty.call(xpSettings, field),
  );
}

/**
 * Format XP amount for display
 * @param {number} amount
 * @returns {string}
 */
export function formatXpAmount(amount) {
  if (typeof amount !== "number") return "0";
  return amount.toString();
}

/**
 * Update XP settings in the database
 * @param {string} guildId
 * @param {Object} xpSettings
 * @param {Object} dbManager
 */
export async function updateXpSettings(guildId, xpSettings, dbManager) {
  const logger = getLogger();

  try {
    // Get current guild settings
    const settings = await dbManager.guildSettings.getByGuild(guildId);

    // Update the experience system settings
    settings.experienceSystem = { ...settings.experienceSystem, ...xpSettings };

    // Save the updated settings
    await dbManager.guildSettings.set(guildId, settings);

    logger.info(`XP settings updated for guild ${guildId}`);
  } catch (error) {
    logger.error(`Failed to update XP settings for guild ${guildId}:`, error);
    throw error;
  }
}

/**
 * Log XP settings access
 * @param {string} guildId
 * @param {string} userId
 * @param {string} action
 */
export function logXpSettingsAccess(guildId, userId, action) {
  const logger = getLogger();
  logger.info(`XP Settings ${action} - Guild: ${guildId}, User: ${userId}`);
}
