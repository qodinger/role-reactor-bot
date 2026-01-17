import { PermissionFlagsBits } from "discord.js";
import { getLogger } from "../logger.js";
import { parseRoleString, extractEmoji } from "./roleParser.js";

// Member cache for reducing API calls
class MemberCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  get(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.member;
    }
    this.cache.delete(key);
    return null;
  }

  set(guildId, userId, member) {
    const key = `${guildId}:${userId}`;
    this.cache.set(key, { member, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const memberCache = new MemberCache();

// Cleanup cache every 5 minutes
setInterval(() => memberCache.cleanup(), 5 * 60 * 1000).unref();

/**
 * Gets a member with caching to reduce API calls
 * @param {import("discord.js").Guild} guild The guild to search in
 * @param {string} userId The user ID to fetch
 * @returns {Promise<import("discord.js").GuildMember|null>} The member, or null if not found
 */
export async function getCachedMember(guild, userId) {
  // Check cache first
  const cached = memberCache.get(guild.id, userId);
  if (cached) {
    return cached;
  }

  try {
    const member = await guild.members.fetch(userId);
    memberCache.set(guild.id, userId, member);
    return member;
  } catch (error) {
    getLogger().debug(`Failed to fetch member ${userId}: ${error.message}`);
    return null;
  }
}

/**
 * Bulk add roles to multiple users to reduce API calls
 * @param {Array<{member: import("discord.js").GuildMember, role: import("discord.js").Role}>} assignments Array of member-role pairs
 * @param {string} reason Reason for adding roles
 * @returns {Promise<Array<{success: boolean, memberId: string, roleId: string, error?: string}>>} Results of each assignment
 */
export async function bulkAddRoles(
  assignments,
  reason = "Bulk role assignment",
) {
  const logger = getLogger();
  const results = [];

  // Adaptive batch size based on operation size
  // Smaller batches for very large operations to be more conservative
  const batchSize =
    assignments.length > 500 ? 5 : assignments.length > 100 ? 8 : 10;

  // Adaptive delay based on operation size
  const batchDelay =
    assignments.length > 500 ? 150 : assignments.length > 100 ? 120 : 100;

  for (let i = 0; i < assignments.length; i += batchSize) {
    const batch = assignments.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ member, role }) => {
      try {
        await member.roles.add(role, reason);
        return { success: true, memberId: member.id, roleId: role.id };
      } catch (error) {
        // Check for rate limit errors specifically
        const isRateLimit =
          error.code === 429 ||
          error.message?.toLowerCase().includes("rate limit") ||
          error.retryAfter;

        if (isRateLimit) {
          logger.warn(
            `Rate limited while adding role ${role.name} to ${member.user.tag}`,
          );
          // Return rate limit error for retry handling
          return {
            success: false,
            memberId: member.id,
            roleId: role.id,
            error: error.message || "Rate limited",
            rateLimited: true,
            retryAfter: error.retryAfter || 1000,
          };
        }

        logger.debug(
          `Failed to add role ${role.name} to ${member.user.tag}: ${error.message}`,
        );
        return {
          success: false,
          memberId: member.id,
          roleId: role.id,
          error: error.message,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    // Process settled results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);

        // If rate limited, apply backoff
        if (result.value.rateLimited) {
          const backoff = result.value.retryAfter || 2000;
          logger.warn(`Rate limit detected, backing off for ${backoff}ms`);
          await new Promise(resolve => {
            setTimeout(() => resolve(), backoff);
          });
        }
      } else {
        results.push({
          success: false,
          memberId: null,
          roleId: null,
          error: result.reason?.message || "Unknown error",
        });
      }
    }

    // Delay between batches to avoid rate limits
    if (i + batchSize < assignments.length) {
      await new Promise(resolve => {
        setTimeout(resolve, batchDelay);
      });
    }
  }

  return results;
}

/**
 * Bulk remove roles from multiple users to reduce API calls
 * @param {Array<{member: import("discord.js").GuildMember, role: import("discord.js").Role}>} assignments Array of member-role pairs
 * @param {string} reason Reason for removing roles
 * @returns {Promise<Array<{success: boolean, memberId: string, roleId: string, error?: string}>>} Results of each removal
 */
export async function bulkRemoveRoles(
  assignments,
  reason = "Bulk role removal",
) {
  const logger = getLogger();
  const results = [];

  // Adaptive batch size based on operation size
  const batchSize =
    assignments.length > 500 ? 5 : assignments.length > 100 ? 8 : 10;

  // Adaptive delay based on operation size
  const batchDelay =
    assignments.length > 500 ? 150 : assignments.length > 100 ? 120 : 100;

  for (let i = 0; i < assignments.length; i += batchSize) {
    const batch = assignments.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ member, role }) => {
      try {
        await member.roles.remove(role, reason);
        return { success: true, memberId: member.id, roleId: role.id };
      } catch (error) {
        // Check for rate limit errors specifically
        const isRateLimit =
          error.code === 429 ||
          error.message?.toLowerCase().includes("rate limit") ||
          error.retryAfter;

        if (isRateLimit) {
          logger.warn(
            `Rate limited while removing role ${role.name} from ${member.user.tag}`,
          );
          return {
            success: false,
            memberId: member.id,
            roleId: role.id,
            error: error.message || "Rate limited",
            rateLimited: true,
            retryAfter: error.retryAfter || 1000,
          };
        }

        logger.debug(
          `Failed to remove role ${role.name} from ${member.user.tag}: ${error.message}`,
        );
        return {
          success: false,
          memberId: member.id,
          roleId: role.id,
          error: error.message,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    // Process settled results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);

        // If rate limited, apply backoff
        if (result.value.rateLimited) {
          const backoff = result.value.retryAfter || 2000;
          logger.warn(`Rate limit detected, backing off for ${backoff}ms`);
          await new Promise(resolve => {
            setTimeout(() => resolve(), backoff);
          });
        }
      } else {
        results.push({
          success: false,
          memberId: null,
          roleId: null,
          error: result.reason?.message || "Unknown error",
        });
      }
    }

    // Delay between batches to avoid rate limits
    if (i + batchSize < assignments.length) {
      await new Promise(resolve => {
        setTimeout(resolve, batchDelay);
      });
    }
  }

  return results;
}

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
      const cleanName = roleConfig.roleName.toLowerCase();
      role = roleNameMap.get(cleanName);

      // If not found by cleaned name, and we extracted an emoji,
      // try to find by re-combining emoji + name (e.g. "♂ Male")
      if (!role && roleConfig.emoji) {
        const emoji = roleConfig.emoji;
        // Try "Emoji Name"
        role = roleNameMap.get(`${emoji} ${cleanName}`.toLowerCase());
        // Try "EmojiName"
        if (!role) {
          role = roleNameMap.get(`${emoji}${cleanName}`.toLowerCase());
        }
      }
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

    if (!roleConfig.emoji) {
      const { emoji } = extractEmoji(role.name);
      if (emoji) {
        roleConfig.emoji = emoji;
      } else {
        validationErrors.push(
          `No emoji provided and none found in role name for "${role.name}"`,
        );
        continue;
      }
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
      roleName: role.name,
      limit: roleConfig.limit || null,
    };
  }

  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  return { success: true, validRoles, roleMapping, errors: [] };
}
