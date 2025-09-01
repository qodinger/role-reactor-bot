import { getLogger } from "../../../utils/logger.js";

/**
 * Validate welcome settings data structure
 * @param {Object} settings
 * @returns {boolean}
 */
export function validateWelcomeSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return false;
  }

  const requiredFields = [
    "enabled",
    "channelId",
    "embedEnabled",
    "autoRoleId",
    "message",
  ];

  return requiredFields.every(field =>
    Object.prototype.hasOwnProperty.call(settings, field),
  );
}

/**
 * Get welcome channel from settings
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {import('discord.js').Channel|null}
 */
export function getWelcomeChannel(guild, channelId) {
  if (!channelId) return null;
  return guild.channels.cache.get(channelId);
}

/**
 * Get auto role from settings
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @returns {import('discord.js').Role|null}
 */
export function getAutoRole(guild, roleId) {
  if (!roleId) return null;
  return guild.roles.cache.get(roleId);
}

/**
 * Format welcome message with placeholders
 * @param {string} message
 * @param {Object} placeholders
 * @returns {string}
 */
export function formatWelcomeMessage(message, placeholders) {
  if (!message) return "Welcome to the server!";

  let formattedMessage = message;

  // Replace placeholders
  Object.entries(placeholders).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, "g");
    formattedMessage = formattedMessage.replace(regex, value);
  });

  return formattedMessage;
}

/**
 * Log welcome settings access
 * @param {string} guildId
 * @param {string} userId
 * @param {string} action
 */
export function logWelcomeSettingsAccess(guildId, userId, action) {
  const logger = getLogger();
  logger.info(
    `Welcome Settings ${action} - Guild: ${guildId}, User: ${userId}`,
  );
}
