import { PermissionFlagsBits } from "discord.js";
import { getLogger } from "../logger.js";
import { parseRoleString } from "./roleParser.js";

/**
 * Gets a role by its name from a guild.
 * @param {import("discord.js").Guild} guild The guild to search in.
 * @param {string} roleName The name of the role to find.
 * @returns {import("discord.js").Role|undefined} The role, or undefined if not found.
 */
export function getRoleByName(guild, roleName) {
  return guild.roles.cache.find(role => role.name === roleName);
}

/**
 * Gets a role by its ID from a guild.
 * @param {import("discord.js").Guild} guild The guild to search in.
 * @param {string} roleId The ID of the role to find.
 * @returns {import("discord.js").Role|undefined} The role, or undefined if not found.
 */
export function getRoleById(guild, roleId) {
  return guild.roles.cache.get(roleId);
}

/**
 * Checks if a member has a specific role.
 * @param {import("discord.js").GuildMember} member The member to check.
 * @param {string} roleId The ID of the role to check for.
 * @returns {boolean} True if the member has the role.
 */
export function userHasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

/**
 * Adds a role to a user.
 * @param {import("discord.js").GuildMember} member The member to add the role to.
 * @param {import("discord.js").Role} role The role to add.
 * @param {string} [reason="Role assignment"] The reason for adding the role.
 * @returns {Promise<boolean>} True if the role was added successfully.
 */
export async function addRoleToUser(member, role, reason = "Role assignment") {
  const logger = getLogger();
  try {
    await member.roles.add(role, reason);
    return true;
  } catch (error) {
    logger.error(
      `Failed to add role ${role.name} to ${member.user.tag}`,
      error,
    );
    return false;
  }
}

/**
 * Removes a role from a user.
 * @param {import("discord.js").GuildMember} member The member to remove the role from.
 * @param {import("discord.js").Role} role The role to remove.
 * @param {string} [reason="Role removal"] The reason for removing the role.
 * @returns {Promise<boolean>} True if the role was removed successfully.
 */
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
      `Failed to remove role ${role.name} from ${member.user.tag}`,
      error,
    );
    return false;
  }
}

/**
 * Checks if a role is manageable by the bot.
 * @param {import("discord.js").Role} role The role to check.
 * @param {import("discord.js").GuildMember} botMember The bot's guild member object.
 * @returns {boolean} True if the role is manageable.
 */
export function isRoleManageable(role, botMember) {
  if (!role || !botMember) return false;

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return false;
  }

  if (role.managed) {
    return false;
  }

  const botHighestRole = botMember.roles.highest;
  return role.position < botHighestRole.position;
}

/**
 * Processes a string of roles, validates them, and returns a structured mapping.
 * @param {import("discord.js").Interaction} interaction The interaction object.
 * @param {string} rolesString The string of roles to process.
 * @returns {Promise<{success: boolean, validRoles: Array<object>, roleMapping: object, errors: Array<string>}>} The result of the processing.
 */
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

    if (!isRoleManageable(role, botMember)) {
      validationErrors.push(
        `Cannot manage role "${role.name}" - it's higher than my highest role or I lack permissions.`,
      );
      continue;
    }

    validRoles.push({
      emoji: roleConfig.emoji,
      roleId: role.id,
      roleName: role.name,
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
