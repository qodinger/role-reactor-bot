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
 * Log XP settings access
 * @param {string} guildId
 * @param {string} userId
 * @param {string} action
 */
export function logXpSettingsAccess(guildId, userId, action) {
  const logger = getLogger();
  logger.info(`XP Settings ${action} - Guild: ${guildId}, User: ${userId}`);
}
