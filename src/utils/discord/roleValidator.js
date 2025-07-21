import { PermissionFlagsBits } from "discord.js";

const VALID_PERMISSION_STRINGS = [
  "CREATE_INSTANT_INVITE",
  "KICK_MEMBERS",
  "BAN_MEMBERS",
  "ADMINISTRATOR",
  "MANAGE_CHANNELS",
  "MANAGE_GUILD",
  "ADD_REACTIONS",
  "VIEW_AUDIT_LOG",
  "PRIORITY_SPEAKER",
  "STREAM",
  "VIEW_CHANNEL",
  "SEND_MESSAGES",
  "SEND_TTS_MESSAGES",
  "MANAGE_MESSAGES",
  "EMBED_LINKS",
  "ATTACH_FILES",
  "READ_MESSAGE_HISTORY",
  "MENTION_EVERYONE",
  "USE_EXTERNAL_EMOJIS",
  "VIEW_GUILD_INSIGHTS",
  "CONNECT",
  "SPEAK",
  "MUTE_MEMBERS",
  "DEAFEN_MEMBERS",
  "MOVE_MEMBERS",
  "USE_VAD",
  "CHANGE_NICKNAME",
  "MANAGE_NICKNAMES",
  "MANAGE_ROLES",
  "MANAGE_WEBHOOKS",
  "MANAGE_EMOJIS_AND_STICKERS",
  "USE_APPLICATION_COMMANDS",
  "REQUEST_TO_SPEAK",
  "MANAGE_EVENTS",
  "MANAGE_THREADS",
  "CREATE_PUBLIC_THREADS",
  "CREATE_PRIVATE_THREADS",
  "USE_EXTERNAL_STICKERS",
  "SEND_MESSAGES_IN_THREADS",
  "START_EMBEDDED_ACTIVITIES",
  "MODERATE_MEMBERS",
];

/**
 * Validates a role name.
 * @param {string} name The role name to validate.
 * @returns {boolean} True if the role name is valid.
 */
export function validateRoleName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.length === 0 || name.length > 100) return false;
  const invalidChars = /[<>@#&]/;
  return !invalidChars.test(name);
}

/**
 * Validates a hex color code.
 * @param {string} color The color to validate.
 * @returns {boolean} True if the color is a valid hex code.
 */
export function validateColor(color) {
  if (!color || typeof color !== "string") return false;
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexColorRegex.test(color);
}

/**
 * Validates an array of permissions.
 * @param {Array<string|number>} permissions The permissions to validate.
 * @returns {boolean} True if all permissions are valid.
 */
export function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) return false;
  return permissions.every(
    p =>
      VALID_PERMISSION_STRINGS.includes(p) ||
      Object.values(PermissionFlagsBits).includes(p),
  );
}

/**
 * Validates role data.
 * @param {object} roleData The role data to validate.
 * @returns {{isValid: boolean, errors: Array<string>}} The validation result.
 */
export function validateRoleData(roleData) {
  const errors = [];
  if (!roleData || typeof roleData !== "object") {
    errors.push("Role data must be an object");
    return { isValid: false, errors };
  }
  if (!validateRoleName(roleData.name)) {
    errors.push("Invalid role name");
  }
  if (roleData.color && !validateColor(roleData.color)) {
    errors.push("Invalid color format");
  }
  if (roleData.permissions && !validatePermissions(roleData.permissions)) {
    errors.push("Invalid permissions");
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}
