import { getLogger } from "../../../utils/logger.js";
import {
  parseDuration,
  removeTemporaryRole,
  getUserTemporaryRoles,
} from "../../../utils/discord/tempRoles.js";

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate if a role can be assigned
 * @param {import('discord.js').Role} role
 * @param {import('discord.js').Guild} guild
 * @returns {Object} {valid: boolean, error?: string, solution?: string}
 */
export function validateRole(role, guild) {
  // Don't assign managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return {
      valid: false,
      error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
      solution:
        "Choose a different role that is not managed by Discord or integrations.",
    };
  }

  // Don't assign bot roles
  if (role.tags && role.tags.botId) {
    return {
      valid: false,
      error: `The role **${role.name}** is a bot role and cannot be assigned.`,
      solution: "Choose a different role that is not associated with a bot.",
    };
  }

  // Check if bot can assign this role (hierarchy check)
  const botMember = guild.members.me;
  if (botMember && role.position >= botMember.roles.highest.position) {
    return {
      valid: false,
      error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
      solution:
        "Move my role above this role in Server Settings → Roles, or choose a lower role.",
    };
  }

  return { valid: true };
}

/**
 * Validate duration string
 * @param {string} durationStr
 * @returns {Object} {valid: boolean, error?: string, solution?: string}
 */
export function validateDuration(durationStr) {
  try {
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return {
        valid: false,
        error: `Invalid duration format: **${durationStr}**`,
        solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
      };
    }

    const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const minDurationMs = 1 * 60 * 1000; // 1 minute in milliseconds

    // Check if duration is too long (more than 1 year)
    if (durationMs > maxDurationMs) {
      return {
        valid: false,
        error: "Duration cannot exceed 1 year.",
        solution: "Choose a shorter duration (maximum: 1y).",
      };
    }

    // Check if duration is too short (less than 1 minute)
    if (durationMs < minDurationMs) {
      return {
        valid: false,
        error: "Duration must be at least 1 minute.",
        solution: "Choose a longer duration (minimum: 1m).",
      };
    }

    return { valid: true };
  } catch (_error) {
    return {
      valid: false,
      error: `Failed to parse duration: **${durationStr}**`,
      solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
    };
  }
}

/**
 * Process user list string into array of valid users
 * @param {string} usersString
 * @param {import('discord.js').CommandInteraction} interaction
 * @returns {Promise<Object>} {valid: boolean, validUsers?: Array, error?: string, solution?: string}
 */
export async function processUserList(usersString, interaction) {
  if (!usersString) {
    return {
      valid: false,
      error: "No users provided.",
      solution:
        "Provide user IDs or mentions separated by commas, semicolons, or spaces.",
    };
  }

  // Split by comma, semicolon, or multiple spaces
  const userList = usersString
    .split(/[,;]|\s{2,}/)
    .map(user => user.trim())
    .filter(user => user.length > 0);

  const logger = getLogger();
  logger.info("Processing user list", {
    usersString,
    userList,
    userCount: userList.length,
  });

  if (userList.length === 0) {
    return {
      valid: false,
      error: "No valid users found in the provided list.",
      solution:
        "Provide user IDs or mentions separated by commas, semicolons, or spaces.",
    };
  }

  const validUsers = [];
  const invalidUsers = [];

  for (const userStr of userList) {
    let userId = null;

    logger.info("Processing user string", { userStr });

    // Check if it's a mention (<@123456789>)
    const mentionMatch = userStr.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      userId = mentionMatch[1];
      logger.info("Found mention", { userStr, userId });
    }
    // Check if it's a plain user ID
    else if (/^\d{17,19}$/.test(userStr)) {
      userId = userStr;
      logger.info("Found user ID", { userStr, userId });
    }

    if (userId) {
      try {
        const user = await interaction.client.users.fetch(userId);
        const member = await interaction.guild.members.fetch(userId);

        logger.info("Successfully fetched user and member", {
          userId,
          username: user.username,
          memberId: member.id,
        });

        if (!validUsers.find(u => u.id === user.id)) {
          validUsers.push({ user, member });
          logger.info("Added user to valid users", {
            userId,
            username: user.username,
            totalValidUsers: validUsers.length,
          });
        } else {
          logger.info("User already in valid users list", {
            userId,
            username: user.username,
          });
        }
      } catch (error) {
        logger.info("Failed to fetch user or member", {
          userStr,
          userId,
          error: error.message,
        });
        invalidUsers.push(userStr);
      }
    } else {
      logger.info("Invalid user format", { userStr });
      invalidUsers.push(userStr);
    }
  }

  if (validUsers.length === 0) {
    return {
      valid: false,
      error: "No valid users found.",
      solution:
        "Make sure the users are in this server and provide valid user IDs or mentions.",
    };
  }

  if (invalidUsers.length > 0) {
    logger.warn(
      `Invalid users in temp role assignment: ${invalidUsers.join(", ")}`,
    );
  }

  const finalValidUsers = validUsers.map(v => v.user);
  logger.info("Final user processing result", {
    totalValidUsers: finalValidUsers.length,
    validUserIds: finalValidUsers.map(u => u.id),
    validUsernames: finalValidUsers.map(u => u.username),
    invalidUsers,
  });

  return { valid: true, validUsers: finalValidUsers };
}

/**
 * Validate if a role is a temporary role for a user
 * @param {string} userId
 * @param {string} roleId
 * @param {string} guildId
 * @returns {Promise<Object>} {valid: boolean, tempRole?: Object, error?: string, solution?: string}
 */
export async function validateTemporaryRole(userId, roleId, guildId) {
  const logger = getLogger();

  try {
    const tempRoles = await getUserTemporaryRoles(guildId, userId);
    const tempRole = tempRoles.find(tr => tr.roleId === roleId);

    if (!tempRole) {
      return {
        valid: false,
        error: "This role is not assigned as a temporary role to the user.",
        solution: "Use `/temp-roles list` to see active temporary roles.",
      };
    }

    // Check if the role has expired
    const now = new Date();
    const expiresAt = new Date(tempRole.expiresAt);
    if (expiresAt < now) {
      return {
        valid: false,
        error: "This temporary role has already expired.",
        solution:
          "The role should have been automatically removed. Try refreshing the list.",
      };
    }

    return { valid: true, tempRole };
  } catch (error) {
    logger.error("Error validating temporary role", error);
    return {
      valid: false,
      error: "Failed to validate temporary role.",
      solution: "Please try again or contact support.",
    };
  }
}

// ============================================================================
// PROCESSING FUNCTIONS
// ============================================================================

/**
 * Calculate time remaining until a specific date
 * @param {Date} expiresAt
 * @returns {string}
 */
export function calculateTimeRemaining(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else {
    return "Less than a minute";
  }
}

/**
 * Get user information from guild
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserInfo(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    return {
      username: member.user.username,
      discriminator: member.user.discriminator,
      id: member.user.id,
    };
  } catch {
    return null;
  }
}

/**
 * Get role information from guild
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @returns {Promise<Object|null>}
 */
export async function getRoleInfo(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return null;
  }

  return {
    name: role.name,
    color: role.color,
    id: role.id,
    position: role.position,
  };
}

/**
 * Process temporary roles and filter out expired ones
 * @param {Array} tempRoles
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @returns {Promise<Array>}
 */
export async function processTempRoles(tempRoles, guild, _client) {
  const processedRoles = [];
  const now = new Date();

  for (const tempRole of tempRoles) {
    const expiresAt = new Date(tempRole.expiresAt);

    // Skip expired roles
    if (expiresAt <= now) {
      continue;
    }

    const userInfo = await getUserInfo(guild, tempRole.userId);
    const roleInfo = await getRoleInfo(guild, tempRole.roleId);

    if (userInfo && roleInfo) {
      const timeRemaining = calculateTimeRemaining(tempRole.expiresAt);
      processedRoles.push({
        ...tempRole,
        userInfo,
        roleInfo,
        timeRemaining,
      });
    }
  }

  return processedRoles;
}

/**
 * Remove role from user
 * @param {import('discord.js').User} user
 * @param {import('discord.js').Role} role
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<Object>} {success: boolean, error?: string, solution?: string}
 */
export async function removeRoleFromUser(
  user,
  role,
  guild,
  reason = "No reason provided",
) {
  const logger = getLogger();

  try {
    const member = await guild.members.fetch(user.id);

    if (!member.roles.cache.has(role.id)) {
      return {
        success: false,
        error: "User does not have this role.",
        solution: "The role may have already been removed or expired.",
      };
    }

    // Check if this is a temporary role assignment (for logging purposes)
    const validation = await validateTemporaryRole(user.id, role.id, guild.id);
    const isTemporaryRole = validation.valid;

    // Remove the role from Discord
    await member.roles.remove(role, `Temporary role removed: ${reason}`);

    // Remove from temporary roles database if it exists there
    if (isTemporaryRole) {
      await removeTemporaryRoleData(user.id, role.id, guild.id);
    }

    return {
      success: true,
      user,
      tempRole: isTemporaryRole ? validation.tempRole : null,
      wasUpdate: false,
    };
  } catch (error) {
    logger.error("Error removing role from user", error);
    return {
      success: false,
      user,
      error: "Failed to remove role from user.",
      solution: "Check bot permissions and role hierarchy.",
    };
  }
}

/**
 * Remove temporary role data
 * @param {string} userId
 * @param {string} roleId
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function removeTemporaryRoleData(userId, roleId, guildId) {
  const logger = getLogger();

  try {
    await removeTemporaryRole(guildId, userId, roleId);
    return true;
  } catch (error) {
    logger.error("Error removing temporary role data", error);
    return false;
  }
}

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

/**
 * Log temporary role assignment
 * @param {import('discord.js').User} assignedBy
 * @param {import('discord.js').Role} role
 * @param {Array} users
 * @param {string} duration
 * @param {string} reason
 * @param {Array} results
 * @param {number} executionTime
 */
export function logTempRoleAssignment(
  assignedBy,
  role,
  users,
  duration,
  reason,
  results,
  executionTime,
) {
  const logger = getLogger();
  const successCount = results.filter(r => r.success).length;
  logger.info(
    `Temporary role assigned - Role: ${role.name} (${role.id}), Duration: ${duration}, Users: ${users.length}, Success: ${successCount}, Assigned by: ${assignedBy.tag} (${assignedBy.id}), Execution time: ${executionTime}ms, Reason: ${reason}`,
  );
}

/**
 * Log temporary roles listing activity
 * @param {import('discord.js').User} user
 * @param {import('discord.js').User} targetUser
 * @param {number} count
 * @param {import('discord.js').Guild} guild
 */
export function logTempRolesListing(user, targetUser, count, guild) {
  const logger = getLogger();
  const action = targetUser
    ? `for user ${targetUser.tag} (${targetUser.id})`
    : "for all users";
  logger.info(
    `Temporary roles listed ${action} - Guild: ${guild.name} (${guild.id}), Requested by: ${user.tag} (${user.id}), Found: ${count}`,
  );
}

/**
 * Log temporary role removal
 * @param {import('discord.js').User} removedBy
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').Role} role
 * @param {string} reason
 * @param {Object} tempRole
 * @param {number} executionTime
 */
export function logTempRoleRemoval(
  removedBy,
  targetUser,
  role,
  reason,
  tempRole,
  executionTime,
) {
  const logger = getLogger();
  logger.info(
    `Temporary role removed - Role: ${role.name} (${role.id}), User: ${targetUser.tag} (${targetUser.id}), Removed by: ${removedBy.tag} (${removedBy.id}), Execution time: ${executionTime}ms, Reason: ${reason}`,
  );
}
