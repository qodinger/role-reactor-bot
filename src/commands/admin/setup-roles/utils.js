import { getLogger } from "../../../utils/logger.js";

/**
 * Validate role setup inputs
 * @param {Object} inputs
 * @returns {Object}
 */
export function validateRoleSetupInputs(inputs) {
  const errors = [];

  if (!inputs.title || inputs.title.trim().length === 0) {
    errors.push("Title is required");
  }

  if (!inputs.description || inputs.description.trim().length === 0) {
    errors.push("Description is required");
  }

  if (!inputs.roles || inputs.roles.trim().length === 0) {
    errors.push("Roles are required");
  }

  if (inputs.color && !isValidHexColor(inputs.color)) {
    errors.push("Invalid color format. Use hex color (e.g., #FF0000)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string is a valid hex color
 * @param {string} color
 * @returns {boolean}
 */
export function isValidHexColor(color) {
  const hexRegex = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Format hex color string
 * @param {string} color
 * @returns {string}
 */
export function formatHexColor(color) {
  if (!color) return null;
  if (!color.startsWith("#")) {
    color = `#${color}`;
  }
  return color;
}

/**
 * Log role setup activity
 * @param {string} guildId
 * @param {string} userId
 * @param {string} action
 * @param {Object} details
 */
export function logRoleSetupActivity(guildId, userId, action, details = {}) {
  const logger = getLogger();
  logger.info(
    `Role Setup ${action} - Guild: ${guildId}, User: ${userId}`,
    details,
  );
}
