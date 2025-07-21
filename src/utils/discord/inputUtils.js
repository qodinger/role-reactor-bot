import { EmbedBuilder } from "discord.js";

/**
 * Sanitizes user input to prevent XSS and injection attacks.
 * @param {string} input The input to sanitize.
 * @returns {string} The sanitized input.
 */
export function sanitizeInput(input) {
  if (typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "")
    .replace(/[&]/g, "&amp;")
    .trim()
    .slice(0, 2000);
}

/**
 * Validates if a string is a valid emoji (Unicode or custom).
 * @param {string} emoji The emoji to validate.
 * @returns {boolean} True if the emoji is valid.
 */
export function isValidEmoji(emoji) {
  if (!emoji) return false;

  const unicodeEmojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  const customEmojiRegex = /<a?:.+?:\d+>/;

  return unicodeEmojiRegex.test(emoji) || customEmojiRegex.test(emoji);
}

/**
 * Validates a duration string (e.g., "30m", "2h", "1d").
 * @param {string} duration The duration string to validate.
 * @returns {boolean} True if the duration is valid.
 */
export function isValidDuration(duration) {
  if (!duration) return false;
  const durationRegex = /^(\d+)(m|h|d|w)$/i;
  return durationRegex.test(duration);
}

/**
 * Parses a duration string into milliseconds.
 * @param {string} duration The duration string to parse.
 * @returns {number} The duration in milliseconds.
 */
export function parseDuration(duration) {
  if (!isValidDuration(duration)) return 0;

  const match = duration.match(/^(\d+)(m|h|d|w)$/i);
  if (!match) return 0;

  const [, amount, unit] = match;
  const numAmount = parseInt(amount, 10);

  switch (unit.toLowerCase()) {
    case "m":
      return numAmount * 60 * 1000;
    case "h":
      return numAmount * 60 * 60 * 1000;
    case "d":
      return numAmount * 24 * 60 * 60 * 1000;
    case "w":
      return numAmount * 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

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
        // isValidEmbedContent is removed, so this check is no longer applicable
        // if (!isValidEmbedContent(value)) {
        //   errors.push(`${field} is too long or contains invalid characters`);
        // }
        break;
      case "color":
        // isValidHexColor is removed, so this check is no longer applicable
        // if (value && !isValidHexColor(value)) {
        //   errors.push(`${field} must be a valid hex color (e.g., #0099ff)`);
        // }
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
  isValidEmoji,
  isValidDuration,
  parseDuration,
  createValidationErrorEmbed,
  validateCommandInputs,
};
