import { PermissionFlagsBits } from "discord.js";
import { getDatabaseManager } from "./databaseManager.js";

// Role mapping functions
export async function getRoleMapping(messageId) {
  try {
    const dbManager = await getDatabaseManager();
    const mappings = await dbManager.getRoleMappings();
    return mappings[messageId] || null;
  } catch (error) {
    console.error("❌ Failed to get role mapping:", error);
    return null;
  }
}

export async function getAllRoleMappings() {
  try {
    const dbManager = await getDatabaseManager();
    return await dbManager.getRoleMappings();
  } catch (error) {
    console.error("❌ Failed to get all role mappings:", error);
    return {};
  }
}

export async function setRoleMapping(messageId, guildId, channelId, roles) {
  try {
    const dbManager = await getDatabaseManager();
    return await dbManager.setRoleMapping(messageId, guildId, channelId, roles);
  } catch (error) {
    console.error("❌ Failed to set role mapping:", error);
    return false;
  }
}

export async function removeRoleMapping(messageId) {
  try {
    const dbManager = await getDatabaseManager();
    return await dbManager.deleteRoleMapping(messageId);
  } catch (error) {
    console.error("❌ Failed to remove role mapping:", error);
    return false;
  }
}

// Role parsing and validation functions
export function parseRoleString(roleString) {
  const roles = {};
  const lines = roleString.trim().split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const match = trimmedLine.match(/^([^\s]+)\s+(.+)$/);
    if (match) {
      const [, emoji, roleName] = match;
      roles[emoji] = roleName.trim();
    }
  }

  return roles;
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
  try {
    await member.roles.add(role, reason);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to add role ${role.name} to ${member.user.tag}:`,
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
  try {
    await member.roles.remove(role, reason);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to remove role ${role.name} from ${member.user.tag}:`,
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
