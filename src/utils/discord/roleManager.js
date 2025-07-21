import { PermissionFlagsBits } from "discord.js";
import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

// Role mapping functions
export async function getRoleMapping(messageId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const mappings = await storageManager.getRoleMappings();
    return mappings[messageId] || null;
  } catch (error) {
    logger.error("❌ Failed to get role mapping", error);
    return null;
  }
}

export async function getAllRoleMappings() {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    return await storageManager.getRoleMappings();
  } catch (error) {
    logger.error("❌ Failed to get all role mappings", error);
    return {};
  }
}

export async function setRoleMapping(messageId, guildId, channelId, roles) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    return await storageManager.setRoleMapping(
      messageId,
      guildId,
      channelId,
      roles,
    );
  } catch (error) {
    logger.error("❌ Failed to set role mapping", error);
    return false;
  }
}

export async function removeRoleMapping(messageId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    return await storageManager.deleteRoleMapping(messageId);
  } catch (error) {
    logger.error("❌ Failed to remove role mapping", error);
    return false;
  }
}

// Role parsing and validation functions
function unescapeHtml(str) {
  return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function parseRoleString(roleString) {
  const roles = [];
  const errors = [];
  const input = unescapeHtml(roleString.trim());
  console.log("Original input:", JSON.stringify(input));

  // Split on commas, semicolons, or newlines
  const parts = input.split(/\s*(?:,|;|\n)\s*/).filter(Boolean);
  for (const part of parts) {
    console.log("Parsing part:", JSON.stringify(part));
    let str = part.trim();

    // 1. Extract emoji (Unicode or custom)
    const emojiMatch = str.match(
      /^(<a?:.+?:\d+>|[\p{Emoji_Presentation}\p{Emoji}\uFE0F])/u,
    );
    if (!emojiMatch) {
      errors.push(`❌ Invalid or missing emoji in part: "${part}"`);
      continue;
    }
    const emoji = emojiMatch[0];
    str = str.slice(emoji.length).trim();

    // 2. Remove optional colon after emoji
    if (str.startsWith(":")) str = str.slice(1).trim();

    // 3. Extract limit (if present at end, after colon or space)
    let limit = null;
    const limitMatch = str.match(/(?::|\s)(\d+)$/);
    if (limitMatch) {
      limit = parseInt(limitMatch[1], 10);
      str = str.slice(0, limitMatch.index).trim();
    }

    // 4. Extract role name (quoted, mention, or plain)
    let roleName = null;
    let roleId = null;
    if (str.startsWith('"')) {
      // Quoted role name
      const quoteMatch = str.match(/^"([^"]+)"$/);
      if (quoteMatch) {
        roleName = quoteMatch[1];
      } else {
        errors.push(`❌ Invalid quoted role name in part: "${part}"`);
        continue;
      }
    } else if (str.match(/^<@&\d+>$/)) {
      // Standard role mention
      roleName = str;
      roleId = str.match(/^<@&(\d+)>$/)[1];
    } else if (str.match(/^@&\d+$/)) {
      // Role mention without angle brackets
      roleName = `<${str}>`;
      roleId = str.match(/^@&(\d+)$/)[1];
    } else {
      // Plain role name
      roleName = str;
    }

    if (!roleName) {
      errors.push(`❌ Invalid role name in part: "${part}"`);
      continue;
    }

    // Validate limit
    if (limit !== null && (isNaN(limit) || limit < 1 || limit > 1000)) {
      errors.push(`❌ Invalid user limit in part: "${part}" (must be 1-1000)`);
      continue;
    }

    // Check for duplicate emoji
    const existingRole = roles.find(r => r.emoji === emoji);
    if (existingRole) {
      errors.push(
        `❌ Duplicate emoji ${emoji} found for roles: "${existingRole.roleName || existingRole.roleId}" and "${roleName || roleId}"`,
      );
      continue;
    }

    roles.push({ emoji, roleName, roleId, limit });
    console.log("Extracted:", { emoji, roleName, roleId, limit });
  }
  return { roles, errors };
}

// Role validation functions
export function validateRoleName(name) {
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
}

export function validateColor(color) {
  if (!color || typeof color !== "string") {
    return false;
  }
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexColorRegex.test(color);
}

export function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return false;
  }
  return permissions.every(
    p =>
      validPermissionStrings.includes(p) ||
      Object.values(PermissionFlagsBits).includes(p),
  );
}

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

// Role utility functions
export function getRoleByName(guild, roleName) {
  return guild.roles.cache.find(role => role.name === roleName);
}

export function getRoleById(guild, roleId) {
  return guild.roles.cache.get(roleId);
}

export function userHasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

export async function addRoleToUser(member, role, reason = "Role assignment") {
  const logger = getLogger();

  try {
    await member.roles.add(role, reason);
    return true;
  } catch (error) {
    logger.error(
      `❌ Failed to add role ${role.name} to ${member.user.tag}`,
      error,
    );
    return false;
  }
}

export async function removeRoleFromUser(
  member,
  role,
  reason = "Role removal",
) {
  const logger = getLogger();

  try {
    await member.roles.remove(role, reason);
    return true;
  } catch (error) {
    logger.error(
      `❌ Failed to remove role ${role.name} from ${member.user.tag}`,
      error,
    );
    return false;
  }
}

export function isRoleManageable(role, botMember) {
  if (!role || !botMember) return false;

  // Check if bot can manage the role
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return false;
  }

  // Check if role is manageable (not managed by integration)
  if (role.managed) {
    return false;
  }

  // Check if bot's highest role is above the target role
  const botHighestRole = botMember.roles.highest;
  if (role.position >= botHighestRole.position) {
    return false;
  }

  return true;
}

export function compareRoles(role1, role2) {
  if (role1.position !== role2.position) {
    return role1.position - role2.position;
  }
  return 0;
}

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

export function formatRolePermissions(permissions) {
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
}

export async function processRoles(interaction, rolesString) {
  const { roles, errors: parseErrors } = parseRoleString(rolesString);
  const validationErrors = [...parseErrors];
  const validRoles = [];
  const roleMapping = {};

  if (roles.length === 0 && parseErrors.length === 0) {
    return {
      success: false,
      errors: ["No roles were provided in the string."],
    };
  }

  const guild = interaction.guild;
  const botMember = await guild.members.fetchMe();
  const roleNameMap = new Map(
    guild.roles.cache.map(role => [role.name.toLowerCase(), role]),
  );

  for (const roleConfig of roles) {
    let role = null;
    if (roleConfig.roleId) {
      role = guild.roles.cache.get(roleConfig.roleId);
    } else {
      role = roleNameMap.get(roleConfig.roleName.toLowerCase());
    }

    if (!role) {
      validationErrors.push(`Role "${roleConfig.roleName}" not found`);
      continue;
    }

    if (role.position >= botMember.roles.highest.position) {
      validationErrors.push(
        `Cannot manage role "${role.name}" - it's higher than my highest role`,
      );
      continue;
    }

    validRoles.push({
      emoji: roleConfig.emoji,
      roleId: role.id,
      roleName: role.name, // Store the actual name for display
      limit: roleConfig.limit || null,
    });

    roleMapping[roleConfig.emoji] = {
      emoji: roleConfig.emoji,
      roleId: role.id,
      limit: roleConfig.limit || null,
    };
  }

  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  return { success: true, validRoles, roleMapping, errors: [] };
}
