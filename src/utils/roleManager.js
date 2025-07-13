import { PermissionFlagsBits } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROLE_MAPPINGS_PATH = path.join(__dirname, "../config/role-mappings.json");

// Load mappings from file at startup
function loadRoleMappingsFromFile() {
  try {
    if (fs.existsSync(ROLE_MAPPINGS_PATH)) {
      const data = fs.readFileSync(ROLE_MAPPINGS_PATH, "utf-8");
      global.roleMappings = JSON.parse(data);
    } else {
      global.roleMappings = {};
    }
  } catch (err) {
    console.error("Failed to load role mappings:", err);
    global.roleMappings = {};
  }
}

// Save mappings to file
function saveRoleMappingsToFile() {
  try {
    fs.writeFileSync(
      ROLE_MAPPINGS_PATH,
      JSON.stringify(global.roleMappings, null, 2),
      "utf-8",
    );
  } catch (err) {
    console.error("Failed to save role mappings:", err);
  }
}

// Load on startup
loadRoleMappingsFromFile();

// Create role options for Discord API
const createRoleOptions = roleData => {
  const options = {
    name: roleData.name || "New Role",
    color: roleData.color || "#FF0000",
    permissions: roleData.permissions || [],
    reason: roleData.reason || "Role creation",
  };
  if ("mentionable" in roleData) options.mentionable = roleData.mentionable;
  if ("hoist" in roleData) options.hoist = roleData.hoist;
  return options;
};

// Validate role name
const validateRoleName = name => {
  if (!name || typeof name !== "string") {
    return false;
  }
  if (name.length === 0 || name.length > 100) {
    return false;
  }
  const invalidChars = /[<>@#&]/;
  if (invalidChars.test(name)) {
    return false;
  }
  return true;
};

// Validate color format
const validateColor = color => {
  if (!color || typeof color !== "string") {
    return false;
  }
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexColorRegex.test(color);
};

// Validate permissions (accepts string keys as well as bitfields)
const validPermissionStrings = [
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
const validatePermissions = permissions => {
  if (!Array.isArray(permissions)) {
    return false;
  }
  return permissions.every(
    p =>
      validPermissionStrings.includes(p) ||
      Object.values(PermissionFlagsBits).includes(p),
  );
};

// Compare roles for sorting (lower position first, then name)
const compareRoles = (role1, role2) => {
  if (role1.position !== role2.position) {
    return role1.position - role2.position;
  }
  return 0;
};

// Validate role data
const validateRoleData = roleData => {
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
};

// Format role permissions for display
const formatRolePermissions = permissions => {
  if (!permissions || permissions.length === 0) {
    return "None";
  }
  const permissionNames = {
    SEND_MESSAGES: "Send Messages",
    READ_MESSAGE_HISTORY: "Read Message History",
    MANAGE_ROLES: "Manage Roles",
    MANAGE_MESSAGES: "Manage Messages",
    ADD_REACTIONS: "Add Reactions",
    VIEW_CHANNEL: "View Channel",
    EMBED_LINKS: "Embed Links",
    ATTACH_FILES: "Attach Files",
    USE_EXTERNAL_EMOJIS: "Use External Emojis",
    CONNECT: "Connect",
    SPEAK: "Speak",
    STREAM: "Stream",
    USE_VAD: "Use Voice Activity Detection",
    PRIORITY_SPEAKER: "Priority Speaker",
    MUTE_MEMBERS: "Mute Members",
    DEAFEN_MEMBERS: "Deafen Members",
    MOVE_MEMBERS: "Move Members",
    MANAGE_NICKNAMES: "Manage Nicknames",
    MANAGE_WEBHOOKS: "Manage Webhooks",
    MANAGE_EMOJIS_AND_STICKERS: "Manage Emojis and Stickers",
    USE_APPLICATION_COMMANDS: "Use Application Commands",
    REQUEST_TO_SPEAK: "Request to Speak",
    MANAGE_THREADS: "Manage Threads",
    USE_PUBLIC_THREADS: "Use Public Threads",
    USE_PRIVATE_THREADS: "Use Private Threads",
    SEND_MESSAGES_IN_THREADS: "Send Messages in Threads",
    USE_EXTERNAL_STICKERS: "Use External Stickers",
  };
  return permissions.map(perm => permissionNames[perm] || perm).join(", ");
};

// Get role by name
const getRoleByName = (guild, roleName) => {
  return guild.roles.cache.find(
    role => role.name.toLowerCase() === roleName.toLowerCase(),
  );
};

// Get role by ID
const getRoleById = (guild, roleId) => {
  return guild.roles.cache.get(roleId);
};

// Check if user has role
const userHasRole = (member, roleId) => {
  return member.roles.cache.has(roleId);
};

// Add role to user
const addRoleToUser = async (member, role, reason = "Role assignment") => {
  try {
    await member.roles.add(role, reason);
    return true;
  } catch (error) {
    console.error("Error adding role to user:", error);
    return false;
  }
};

// Remove role from user
const removeRoleFromUser = async (member, role, reason = "Role removal") => {
  try {
    await member.roles.remove(role, reason);
    return true;
  } catch (error) {
    console.error("Error removing role from user:", error);
    return false;
  }
};

// Get user's roles
const getUserRoles = member => {
  return member.roles.cache.filter(role => role.name !== "@everyone");
};

// Get role members count
const getRoleMemberCount = role => {
  return role.members.size;
};

// Check if role is manageable by bot
const isRoleManageable = (role, botMember) => {
  if (!botMember) return false;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return false;
  }
  const botHighestRole = botMember.roles.highest;
  return role.position < botHighestRole.position;
};

// Parse role string (flat, no categories)
const parseRoleString = rolesString => {
  const roles = [];
  const errors = [];

  // Split by comma or newline
  const lines = rolesString
    .split(/,|\n/)
    .map(line => line.trim())
    .filter(line => line);

  for (const line of lines) {
    // Support emoji:role or emoji:role:limit
    const parts = line.split(":").map(s => s.trim());
    const [emoji, roleName, limitStr] = parts;
    if (!emoji || !roleName) {
      errors.push(
        `❌ Invalid format: "${line}" (use format: emoji:role or emoji:role:limit)`,
      );
      continue;
    }
    if (!isValidEmoji(emoji)) {
      errors.push(`❌ Invalid emoji: "${emoji}"`);
      continue;
    }
    let limit = undefined;
    if (limitStr && !isNaN(Number(limitStr))) {
      limit = parseInt(limitStr, 10);
    }
    roles.push({ emoji, roleName, limit });
  }
  return { roles, errors };
};

// Validate emoji format
const isValidEmoji = emoji => {
  // Check if it's a custom emoji (format: <:name:id>)
  const customEmojiRegex = /^<a?:.+?:\d+>$/;
  if (customEmojiRegex.test(emoji)) return true;

  // Check if it's a Unicode emoji (using regex for emoji ranges)
  // This regex matches most common Unicode emojis
  const unicodeEmojiRegex = /\p{Emoji}/u;
  return unicodeEmojiRegex.test(emoji);
};

// Parse emoji to get the name/id
const parseEmoji = emoji => {
  if (emoji.length === 1) {
    return emoji; // Unicode emoji
  }

  // Custom emoji: extract the name
  const match = emoji.match(/^<a?:(.+?):\d+>$/);
  return match ? match[1] : emoji;
};

// Store role mapping for a specific message
const setRoleMapping = async (messageId, roleMapping) => {
  if (!global.roleMappings) {
    global.roleMappings = {};
  }
  global.roleMappings[messageId] = roleMapping;
  saveRoleMappingsToFile();
  return true;
};

// Get role mapping for a specific message
const getRoleMapping = async messageId => {
  if (!global.roleMappings) {
    return null;
  }
  return global.roleMappings[messageId] || null;
};

// Remove role mapping for a specific message
const removeRoleMapping = async messageId => {
  if (!global.roleMappings) {
    return;
  }
  delete global.roleMappings[messageId];
  saveRoleMappingsToFile();
};

// Get all role mappings
const getAllRoleMappings = async () => {
  return global.roleMappings || {};
};

export {
  createRoleOptions,
  validateRoleName,
  validateColor,
  validatePermissions,
  compareRoles,
  validateRoleData,
  formatRolePermissions,
  getRoleByName,
  getRoleById,
  userHasRole,
  addRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getRoleMemberCount,
  isRoleManageable,
  parseRoleString,
  isValidEmoji,
  parseEmoji,
  setRoleMapping,
  getRoleMapping,
  removeRoleMapping,
  getAllRoleMappings,
};
