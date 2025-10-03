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
 * Validate welcome message
 * @param {string} message
 * @returns {boolean}
 */
export function isValidMessage(message) {
  if (typeof message !== "string") return false;

  // Allow empty message (will use default)
  if (message.trim() === "") return true;

  // Check length (Discord embed description limit is 4096)
  if (message.length > 4000) return false;

  // Check for basic placeholder validation
  const validPlaceholders = ["{user}", "{server}", "{memberCount}"];
  const hasValidPlaceholder = validPlaceholders.some(placeholder =>
    message.includes(placeholder),
  );

  // Message is valid if it has at least one valid placeholder or is empty
  return hasValidPlaceholder || message.trim() === "";
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
 * @returns {boolean}
 */
export function isValidRole(roleInput) {
  if (!roleInput || typeof roleInput !== "string") return true; // Optional field

  // Check if it's a role mention <@&123456789>
  const mentionMatch = roleInput.match(/<@&(\d+)>/);
  if (mentionMatch) {
    return /^\d{17,19}$/.test(mentionMatch[1]);
  }

  // Check if it's a plain ID
  if (/^\d{17,19}$/.test(roleInput)) {
    return true;
  }

  // Check if it's a non-empty string (role name)
  return roleInput.trim().length > 0;
}
