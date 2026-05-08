/**
 * Validate channel ID format
 * @param {string} channelId
 * @returns {boolean}
 */
export function isValidChannelId(channelId) {
  if (!channelId || typeof channelId !== "string") return false;

  // Extract ID from mention format <#123456789> or use as-is
  const idMatch = channelId.match(/<#(\d+)>/) || [null, channelId];
  const id = idMatch[1];

  // Check if it's a valid Discord ID (17-19 digits)
  return /^\d{17,19}$/.test(id);
}

/**
 * Validate welcome message with sanitization
 * @param {string} message
 * @returns {{ valid: boolean, sanitized: string, error?: string, warning?: string }}
 */
export function validateWelcomeMessage(message) {
  if (typeof message !== "string") {
    return { valid: false, sanitized: "", error: "Message must be a string" };
  }

  // Allow empty message (will use default)
  if (message.trim() === "") {
    return { valid: true, sanitized: "" };
  }

  // Sanitize the message
  const { InputSanitizer, InputValidator } = require("./inputValidation.js");
  const sanitized = InputSanitizer.sanitize(message);

  // Check for malicious content
  if (InputValidator.containsMaliciousContent(message)) {
    return {
      valid: false,
      sanitized: "",
      error: "Message contains disallowed HTML or script content",
    };
  }

  // Check length (Discord embed description limit is 4096)
  if (sanitized.length > 4000) {
    return {
      valid: false,
      sanitized,
      error: "Message exceeds maximum length of 4000 characters",
    };
  }

  // Check for basic placeholder validation
  const validPlaceholders = ["{user}", "{server}", "{memberCount}"];
  const hasValidPlaceholder = validPlaceholders.some(placeholder =>
    sanitized.includes(placeholder),
  );

  // Message is valid if it has at least one valid placeholder or is empty
  if (!hasValidPlaceholder && sanitized.trim() !== "") {
    return {
      valid: true,
      sanitized,
      warning: "Consider adding a placeholder like {user}",
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate welcome message (legacy support)
 * @param {string} message
 * @returns {boolean}
 */
export function isValidMessage(message) {
  return validateWelcomeMessage(message).valid;
}

/**
 * Validate boolean string
 * @param {string} value
 * @returns {boolean}
 */
export function isValidBoolean(value) {
  if (typeof value !== "string") return false;
  const lowerValue = value.toLowerCase();
  return lowerValue === "true" || lowerValue === "false";
}

/**
 * Validate role input
 * @param {string} roleInput
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateRole(roleInput) {
  if (!roleInput || typeof roleInput !== "string") {
    return { valid: true, sanitized: "" }; // Optional field
  }

  // Sanitize the input
  const { InputSanitizer } = require("./inputValidation.js");
  const sanitized = InputSanitizer.sanitize(roleInput);

  // Check if it's a role mention <@&123456789>
  const mentionMatch = sanitized.match(/<@&(\d+)>/);
  if (mentionMatch) {
    if (!/^\d{17,19}$/.test(mentionMatch[1])) {
      return { valid: false, sanitized, error: "Invalid role ID format" };
    }
    return { valid: true, sanitized };
  }

  // Check if it's a plain ID
  if (/^\d{17,19}$/.test(sanitized)) {
    return { valid: true, sanitized };
  }

  // Check if it's a non-empty string (role name)
  if (sanitized.trim().length === 0) {
    return { valid: false, sanitized, error: "Role cannot be empty" };
  }

  return { valid: true, sanitized };
}

/**
 * Validate role input (legacy support)
 * @param {string} roleInput
 * @returns {boolean}
 */
export function isValidRole(roleInput) {
  return validateRole(roleInput).valid;
}

/**
 * Validate and sanitize channel ID
 * @param {string} channelId
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateChannelId(channelId) {
  if (!channelId || typeof channelId !== "string") {
    return { valid: false, sanitized: "", error: "Channel ID is required" };
  }

  const { InputSanitizer } = require("./inputValidation.js");
  const sanitized = InputSanitizer.sanitize(channelId);

  // Extract ID from mention format <#123456789> or use as-is
  const idMatch = sanitized.match(/<#(\d+)>/) || [null, sanitized];
  const id = idMatch[1];

  // Check if it's a valid Discord ID (17-19 digits)
  if (!/^\d{17,19}$/.test(id)) {
    return { valid: false, sanitized, error: "Invalid channel ID format" };
  }

  return { valid: true, sanitized: id };
}
