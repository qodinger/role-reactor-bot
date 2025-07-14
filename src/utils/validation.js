import { EmbedBuilder } from "discord.js";

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param {string} input - The input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = input => {
  if (typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/[&]/g, "&amp;") // Escape ampersands
    .trim()
    .slice(0, 2000); // Limit length to prevent abuse
};

/**
 * Validate hex color format
 * @param {string} color - Color string to validate
 * @returns {boolean} - Whether the color is valid
 */
export const isValidHexColor = color => {
  if (!color) return false;
  const hex = color.startsWith("#") ? color : `#${color}`;
  return /^#[0-9A-F]{6}$/i.test(hex);
};

/**
 * Validate emoji format (unicode or custom)
 * @param {string} emoji - Emoji to validate
 * @returns {boolean} - Whether the emoji is valid
 */
export const isValidEmoji = emoji => {
  if (!emoji) return false;

  // Unicode emoji regex
  const unicodeEmojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

  // Custom emoji regex
  const customEmojiRegex = /<a?:.+?:\d+>/;

  return unicodeEmojiRegex.test(emoji) || customEmojiRegex.test(emoji);
};

/**
 * Validate duration format (e.g., "30m", "2h", "1d")
 * @param {string} duration - Duration string to validate
 * @returns {boolean} - Whether the duration is valid
 */
export const isValidDuration = duration => {
  if (!duration) return false;

  const durationRegex = /^(\d+)(m|h|d|w)$/i;
  return durationRegex.test(duration);
};

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., "30m", "2h", "1d")
 * @returns {number} - Duration in milliseconds
 */
export const parseDuration = duration => {
  if (!isValidDuration(duration)) return 0;

  const match = duration.match(/^(\d+)(m|h|d|w)$/i);
  if (!match) return 0;

  const [, amount, unit] = match;
  const numAmount = parseInt(amount, 10);

  switch (unit.toLowerCase()) {
    case "m":
      return numAmount * 60 * 1000; // minutes
    case "h":
      return numAmount * 60 * 60 * 1000; // hours
    case "d":
      return numAmount * 24 * 60 * 60 * 1000; // days
    case "w":
      return numAmount * 7 * 24 * 60 * 60 * 1000; // weeks
    default:
      return 0;
  }
};

/**
 * Validate role name format
 * @param {string} roleName - Role name to validate
 * @returns {boolean} - Whether the role name is valid
 */
export const isValidRoleName = roleName => {
  if (!roleName || typeof roleName !== "string") return false;

  // Role names should be 1-100 characters, no special characters
  const roleNameRegex = /^[a-zA-Z0-9\s\-_]{1,100}$/;
  return roleNameRegex.test(roleName.trim());
};

/**
 * Validate message content for embeds
 * @param {string} content - Content to validate
 * @returns {boolean} - Whether the content is valid for embeds
 */
export const isValidEmbedContent = content => {
  if (!content || typeof content !== "string") return false;

  // Check length limits
  if (content.length > 4000) return false;

  // Check for excessive mentions or formatting
  const mentionCount = (content.match(/@/g) || []).length;
  if (mentionCount > 10) return false;

  return true;
};

/**
 * Create a validation error embed
 * @param {string} field - The field that failed validation
 * @param {string} reason - The reason for the validation failure
 * @returns {EmbedBuilder} - Error embed
 */
export const createValidationErrorEmbed = (field, reason) => {
  return new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("❌ Validation Error")
    .setDescription(`**Field:** ${field}\n**Issue:** ${reason}`)
    .setTimestamp()
    .setFooter({ text: "Please check your input and try again" });
};

/**
 * Validate all inputs for a command
 * @param {Object} inputs - Object containing input values
 * @returns {Object} - Validation result with errors array
 */
export const validateCommandInputs = inputs => {
  const errors = [];

  for (const [field, value] of Object.entries(inputs)) {
    if (value === null || value === undefined) {
      errors.push(`${field} is required`);
      continue;
    }

    switch (field) {
      case "title":
      case "description":
        if (!isValidEmbedContent(value)) {
          errors.push(`${field} is too long or contains invalid characters`);
        }
        break;
      case "color":
        if (value && !isValidHexColor(value)) {
          errors.push(`${field} must be a valid hex color (e.g., #0099ff)`);
        }
        break;
      case "duration":
        if (value && !isValidDuration(value)) {
          errors.push(`${field} must be in format: 30m, 2h, 1d, 1w`);
        }
        break;
      case "emoji":
        if (value && !isValidEmoji(value)) {
          errors.push(`${field} must be a valid emoji`);
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default {
  sanitizeInput,
  isValidHexColor,
  isValidEmoji,
  isValidDuration,
  parseDuration,
  isValidRoleName,
  isValidEmbedContent,
  createValidationErrorEmbed,
  validateCommandInputs,
};
