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
 * Validate hex color format
 * @param {string} color
 * @returns {boolean}
 */
export function validateColor(color) {
  const hex = color.startsWith("#") ? color : `#${color}`;
  return /^#[0-9A-F]{6}$/i.test(hex);
}

/**
 * Process updates object
 */
export const processUpdates = {
  /**
   * Format color to hex format
   * @param {string} color
   * @returns {string}
   */
  formatColor(color) {
    return color.startsWith("#") ? color : `#${color}`;
  },

  /**
   * Validate title update
   * @param {string} title
   * @returns {boolean}
   */
  validateTitle(title) {
    return title && title.trim().length > 0;
  },

  /**
   * Validate description update
   * @param {string} description
   * @returns {boolean}
   */
  validateDescription(description) {
    return description && description.trim().length > 0;
  },

  /**
   * Validate roles update
   * @param {string} roles
   * @returns {boolean}
   */
  validateRoles(roles) {
    return roles && roles.trim().length > 0;
  },
};

/**
 * Log role update activity
 * @param {string} guildId
 * @param {string} userId
 * @param {string} messageId
 * @param {Array} updates
 */
export function logRoleUpdateActivity(guildId, userId, messageId, updates) {
  const logger = getLogger();
  logger.info(
    `Role update - Guild: ${guildId}, User: ${userId}, Message: ${messageId}, Updates: ${updates.join(", ")}`,
  );
}
