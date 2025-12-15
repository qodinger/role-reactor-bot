import { PermissionFlagsBits } from "discord.js";
import config from "../../config/config.js";

const DEVELOPER_IDS = config.discord.developers || [];

/**
 * All required bot permissions for the Role Reactor bot
 * This array is used for:
 * - Permission validation (botHasRequiredPermissions, getMissingBotPermissions)
 * - Bot invite link generation (DEFAULT_INVITE_PERMISSIONS)
 */
export const BOT_PERMISSIONS = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles, // To send image attachments (avatar generation, imagine command)
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.UseExternalEmojis,
  // Moderation permissions
  PermissionFlagsBits.ModerateMembers, // For timeout command
  PermissionFlagsBits.BanMembers, // For ban/unban commands
  PermissionFlagsBits.KickMembers, // For kick command
  // Voice restrictions permissions
  PermissionFlagsBits.MoveMembers, // To disconnect users from voice channels
  PermissionFlagsBits.MuteMembers, // To mute users in voice channels
];

/**
 * Checks if a user is a developer.
 * @param {string} userId The user's ID.
 * @returns {boolean}
 */
export function isDeveloper(userId) {
  return DEVELOPER_IDS.includes(userId);
}

/**
 * Checks if a member has administrator-level permissions.
 * @param {import("discord.js").GuildMember} member The guild member.
 * @returns {boolean}
 */
export function hasAdminPermissions(member) {
  if (!member) return false;

  // Check if permissions property exists and has the has method
  if (!member.permissions || typeof member.permissions.has !== "function") {
    return false;
  }

  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Checks if a member has permission to manage roles.
 * @param {import("discord.js").GuildMember} member The guild member.
 * @returns {boolean}
 */
export function hasManageRolesPermission(member) {
  if (!member) return false;

  // Check if permissions property exists and has the has method
  if (!member.permissions || typeof member.permissions.has !== "function") {
    return false;
  }

  return member.permissions.has(PermissionFlagsBits.ManageRoles);
}

/**
 * Checks if the bot has all required permissions in a guild.
 * @param {import("discord.js").Guild} guild The guild to check.
 * @returns {boolean}
 */
export function botHasRequiredPermissions(guild) {
  if (!guild || !guild.members.me) return false;
  const botMember = guild.members.me;
  return BOT_PERMISSIONS.every(perm => botMember.permissions.has(perm));
}

/**
 * Gets a list of missing permissions for the bot in a guild.
 * @param {import("discord.js").Guild} guild The guild to check.
 * @returns {import("discord.js").PermissionFlagsBits[]} An array of missing permission flags.
 */
export function getMissingBotPermissions(guild) {
  if (!guild || !guild.members.me) {
    // If we can't access the bot member, return all required permissions
    // as missing to ensure the user knows what's needed
    return [...BOT_PERMISSIONS];
  }
  const botMember = guild.members.me;
  return BOT_PERMISSIONS.filter(perm => !botMember.permissions.has(perm));
}

/**
 * Formats a permission flag into a human-readable string.
 * @param {import("discord.js").PermissionFlagsBits} permission The permission flag.
 * @returns {string} The formatted permission name.
 */
export function formatPermissionName(permission) {
  // Convert to BigInt if needed (Discord.js v14 uses BigInt for permissions)
  const permissionValue =
    typeof permission === "bigint" ? permission : BigInt(permission);

  // Find the permission name by comparing BigInt values
  const permissionName = Object.keys(PermissionFlagsBits).find(key => {
    const flagValue = PermissionFlagsBits[key];
    const bigIntValue =
      typeof flagValue === "bigint" ? flagValue : BigInt(flagValue);
    return bigIntValue === permissionValue;
  });

  if (!permissionName) {
    return "Unknown Permission";
  }

  return permissionName.replace(/([A-Z])/g, " $1").trim();
}
