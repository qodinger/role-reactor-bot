import { getLogger } from "../logger.js";

const logger = getLogger();

const DISCORD_ID_REGEX = /^\d{17,19}$/;
const CUSTOM_EMOJI_REGEX = /^<a?:[a-zA-Z0-9_]+:\d{17,19}>$/;
// A basic regex for Unicode emojis. For a more comprehensive one, consider a library.
const UNICODE_EMOJI_REGEX =
  /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /file:/gi,
];

/**
 * Validates a Discord ID (user, guild, channel, etc.).
 * @param {string} id The ID to validate.
 * @returns {boolean} True if the ID is valid.
 */
export function validateId(id) {
  return typeof id === "string" && DISCORD_ID_REGEX.test(id);
}

/**
 * Validates a Discord emoji (custom or Unicode).
 * @param {string} emoji The emoji to validate.
 * @returns {boolean} True if the emoji is valid.
 */
export function validateEmoji(emoji) {
  if (!emoji || typeof emoji !== "string") {
    return false;
  }
  return CUSTOM_EMOJI_REGEX.test(emoji) || UNICODE_EMOJI_REGEX.test(emoji);
}

/**
 * Sanitizes a string to prevent injection attacks.
 * @param {string} input The string to sanitize.
 * @param {number} maxLength The maximum allowed length.
 * @returns {string} The sanitized string.
 */
export function sanitizeString(input, maxLength = 1000) {
  if (!input || typeof input !== "string") {
    return "";
  }
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\u0000-\u001F\u007F]/g, "");
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized.substring(0, maxLength).trim();
}

/**
 * Validates a URL for security.
 * @param {string} url The URL to validate.
 * @returns {boolean} True if the URL is valid and safe.
 */
export function validateUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(url)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Logs a security-related event.
 * @param {string} event The name of the security event.
 * @param {Object} data Additional data to log with the event.
 */
export function logSecurityEvent(event, data = {}) {
  logger.warn(`Security Event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  });
}
