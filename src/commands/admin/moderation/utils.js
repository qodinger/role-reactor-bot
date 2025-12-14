import { PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { EMOJIS } from "../../../config/theme.js";

const logger = getLogger();

// ============================================================================
// PERMISSION AND HIERARCHY VALIDATION
// ============================================================================

/**
 * Check if a member can moderate another member based on role hierarchy
 * @param {import('discord.js').GuildMember} moderator - The member trying to moderate
 * @param {import('discord.js').GuildMember} target - The member being moderated
 * @returns {Object} {canModerate: boolean, reason?: string}
 */
export function canModerateMember(moderator, target) {
  if (!moderator || !target) {
    return {
      canModerate: false,
      reason: "Invalid member data",
    };
  }

  // Can't moderate yourself
  if (moderator.id === target.id) {
    return {
      canModerate: false,
      reason: "You cannot moderate yourself",
    };
  }

  // Can't moderate bots
  if (target.user.bot) {
    return {
      canModerate: false,
      reason: "You cannot moderate bots",
    };
  }

  // Can't moderate the guild owner
  if (target.id === target.guild.ownerId) {
    return {
      canModerate: false,
      reason: "You cannot moderate the server owner",
    };
  }

  // Check if moderator has admin permissions (bypass hierarchy)
  if (moderator.permissions.has(PermissionFlagsBits.Administrator)) {
    return { canModerate: true };
  }

  // Check role hierarchy
  const moderatorHighestRole = moderator.roles.highest;
  const targetHighestRole = target.roles.highest;

  if (moderatorHighestRole.position <= targetHighestRole.position) {
    return {
      canModerate: false,
      reason: `You cannot moderate members with equal or higher roles. Your highest role is ${moderatorHighestRole.name}, their highest role is ${targetHighestRole.name}`,
    };
  }

  return { canModerate: true };
}

/**
 * Check if bot can moderate a member
 * @param {import('discord.js').GuildMember} botMember - Bot's guild member
 * @param {import('discord.js').GuildMember} target - Target member
 * @returns {Object} {canModerate: boolean, reason?: string}
 */
export function botCanModerateMember(botMember, target) {
  if (!botMember || !target) {
    return {
      canModerate: false,
      reason: "Invalid member data",
    };
  }

  // Can't moderate bots
  if (target.user.bot) {
    return {
      canModerate: false,
      reason: "Cannot moderate bots",
    };
  }

  // Can't moderate the guild owner
  if (target.id === target.guild.ownerId) {
    return {
      canModerate: false,
      reason: "Cannot moderate the server owner",
    };
  }

  // Check role hierarchy
  const botHighestRole = botMember.roles.highest;
  const targetHighestRole = target.roles.highest;

  if (botHighestRole.position <= targetHighestRole.position) {
    return {
      canModerate: false,
      reason: `Bot's highest role (${botHighestRole.name}) is not above target's highest role (${targetHighestRole.name})`,
    };
  }

  return { canModerate: true };
}

/**
 * Validate timeout duration
 * @param {string} duration - Duration string (e.g., "1h", "2d", "30m")
 * @returns {Object} {valid: boolean, milliseconds?: number, error?: string}
 */
export function validateTimeoutDuration(duration) {
  if (!duration || typeof duration !== "string") {
    return {
      valid: false,
      error: "Duration is required",
    };
  }

  // Parse duration (similar to temp-roles)
  const durationRegex = /^(\d+)([smhdw])$/i;
  const match = duration.match(durationRegex);

  if (!match) {
    return {
      valid: false,
      error: "Invalid duration format. Use format like: 30m, 1h, 2d, 1w",
    };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (value <= 0) {
    return {
      valid: false,
      error: "Duration must be greater than 0",
    };
  }

  // Convert to milliseconds
  const multipliers = {
    s: 1000, // seconds
    m: 60 * 1000, // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
    w: 7 * 24 * 60 * 60 * 1000, // weeks
  };

  const milliseconds = value * multipliers[unit];

  // Discord timeout limits: minimum 10 seconds, maximum 28 days
  const MIN_TIMEOUT = 10 * 1000; // 10 seconds
  const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // 28 days

  if (milliseconds < MIN_TIMEOUT) {
    return {
      valid: false,
      error: "Timeout duration must be at least 10 seconds",
    };
  }

  if (milliseconds > MAX_TIMEOUT) {
    return {
      valid: false,
      error: "Timeout duration cannot exceed 28 days",
    };
  }

  return {
    valid: true,
    milliseconds,
  };
}

/**
 * Format duration for display
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}

// ============================================================================
// MODERATION LOGGING
// ============================================================================

/**
 * Log a moderation action to storage
 * @param {Object} actionData - Action data
 * @param {string} actionData.guildId - Guild ID
 * @param {string} actionData.userId - Target user ID
 * @param {string} actionData.moderatorId - Moderator user ID
 * @param {string} actionData.action - Action type (timeout, warn, ban, kick, etc.)
 * @param {string} actionData.reason - Reason for action
 * @param {Object} actionData.metadata - Additional metadata
 * @returns {Promise<string>} Case ID
 */
export async function logModerationAction(actionData) {
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();

  const caseId = generateCaseId();
  const timestamp = new Date().toISOString();

  const logEntry = {
    caseId,
    guildId: actionData.guildId,
    userId: actionData.userId,
    moderatorId: actionData.moderatorId,
    action: actionData.action,
    reason: actionData.reason || "No reason provided",
    metadata: actionData.metadata || {},
    timestamp,
  };

  // Get existing moderation logs
  const moderationLogs = (await storage.get("moderation_logs")) || {};

  // Initialize guild logs if needed
  if (!moderationLogs[actionData.guildId]) {
    moderationLogs[actionData.guildId] = {};
  }

  // Initialize user logs if needed
  if (!moderationLogs[actionData.guildId][actionData.userId]) {
    moderationLogs[actionData.guildId][actionData.userId] = [];
  }

  // Add log entry
  moderationLogs[actionData.guildId][actionData.userId].push(logEntry);

  // Keep only last 100 entries per user to prevent storage bloat
  if (moderationLogs[actionData.guildId][actionData.userId].length > 100) {
    moderationLogs[actionData.guildId][actionData.userId] =
      moderationLogs[actionData.guildId][actionData.userId].slice(-100);
  }

  // Save to storage
  await storage.set("moderation_logs", moderationLogs);

  logger.info(
    `${EMOJIS.MODERATION.DEFAULT} Moderation action logged: ${actionData.action} on user ${actionData.userId} by ${actionData.moderatorId} (Case: ${caseId})`,
  );

  return caseId;
}

/**
 * Get moderation history for a user
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of moderation logs
 */
export async function getModerationHistory(guildId, userId) {
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();

  const moderationLogs = (await storage.get("moderation_logs")) || {};

  if (!moderationLogs[guildId] || !moderationLogs[guildId][userId]) {
    return [];
  }

  return moderationLogs[guildId][userId];
}

/**
 * Get all moderation history for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<Array>} Array of all moderation logs with userId included
 */
export async function getAllModerationHistory(guildId) {
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();

  const moderationLogs = (await storage.get("moderation_logs")) || {};

  if (!moderationLogs[guildId]) {
    return [];
  }

  // Flatten all user histories into a single array with userId included
  const allHistory = [];
  for (const [userId, userHistory] of Object.entries(moderationLogs[guildId])) {
    for (const log of userHistory) {
      allHistory.push({
        ...log,
        userId, // Include userId for server-wide history
      });
    }
  }

  return allHistory;
}

/**
 * Get warn count for a user
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of warnings
 */
export async function getWarnCount(guildId, userId) {
  const history = await getModerationHistory(guildId, userId);
  return history.filter(log => log.action === "warn").length;
}

/**
 * Remove a specific warning by case ID
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {string} caseId - Case ID of warning to remove
 * @returns {Promise<Object>} {success: boolean, removed: boolean, error?: string}
 */
export async function removeWarning(guildId, userId, caseId) {
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();

  const moderationLogs = (await storage.get("moderation_logs")) || {};

  if (
    !moderationLogs[guildId] ||
    !moderationLogs[guildId][userId] ||
    !Array.isArray(moderationLogs[guildId][userId])
  ) {
    return {
      success: false,
      removed: false,
      error: "No moderation history found for this user",
    };
  }

  const userLogs = moderationLogs[guildId][userId];
  const initialLength = userLogs.length;

  // Remove the warning with matching case ID
  moderationLogs[guildId][userId] = userLogs.filter(
    log => !(log.action === "warn" && log.caseId === caseId),
  );

  const removed = moderationLogs[guildId][userId].length < initialLength;

  if (removed) {
    // Save updated logs
    await storage.set("moderation_logs", moderationLogs);
    logger.info(
      `🗑️ Warning removed: Case ${caseId} for user ${userId} in guild ${guildId}`,
    );
  }

  return {
    success: true,
    removed,
    error: removed ? null : "Warning not found with the provided case ID",
  };
}

/**
 * Parse multiple users from a string input
 * Supports user mentions (<@123456789>) and user IDs (123456789)
 * Similar to processUserList in temp-roles but returns user and member objects
 * @param {string} usersString - String containing user mentions or IDs
 * @param {import('discord.js').Guild} guild - The guild to fetch members from
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<Object>} {valid: boolean, validUsers?: Array<{user, member}>, error?: string, solution?: string, invalidUsers?: Array}
 */
export async function parseMultipleUsers(usersString, guild, client) {
  if (!usersString || !guild || !client) {
    return {
      valid: false,
      error: "No users provided.",
      solution:
        "Provide user IDs or mentions separated by commas, semicolons, or spaces.",
    };
  }

  // Split by comma, semicolon, or spaces, and also handle mentions without spaces
  let userList = usersString
    .split(/[,;]|\s+/)
    .map(user => user.trim())
    .filter(user => user.length > 0);

  // Handle cases where mentions are concatenated without spaces (e.g., @user1@user2)
  const expandedUserList = [];
  for (const userStr of userList) {
    // Check if this string contains multiple mentions without spaces
    const mentions = userStr.match(/<@!?\d+>/g);
    if (mentions && mentions.length > 1) {
      // Split by mentions and add each mention separately
      const parts = userStr.split(/(<@!?\d+>)/);
      for (const part of parts) {
        if (part.trim() && part.match(/<@!?\d+>/)) {
          expandedUserList.push(part.trim());
        }
      }
    } else {
      expandedUserList.push(userStr);
    }
  }

  userList = expandedUserList;

  const validUsers = [];
  const invalidUsers = [];
  const seenUserIds = new Set();

  for (const userStr of userList) {
    let userId = null;

    // Check if it's a mention (<@123456789> or <@!123456789>)
    const mentionMatch = userStr.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      userId = mentionMatch[1];
    }
    // Check if it's a plain user ID
    else if (/^\d{17,19}$/.test(userStr)) {
      userId = userStr;
    }

    if (userId) {
      // Skip duplicates
      if (seenUserIds.has(userId)) {
        continue;
      }
      seenUserIds.add(userId);

      try {
        const user = await client.users.fetch(userId);
        let member = null;
        try {
          member = await guild.members.fetch(userId);
        } catch (memberError) {
          // User might not be in the guild (for ban operations)
          logger.debug(
            `User ${userId} not found in guild: ${memberError.message}`,
          );
        }

        if (!validUsers.find(u => u.user.id === user.id)) {
          validUsers.push({ user, member });
        }
      } catch (error) {
        logger.debug(`Failed to fetch user ${userId}: ${error.message}`);
        invalidUsers.push(userStr);
      }
    } else {
      invalidUsers.push(userStr);
    }
  }

  if (validUsers.length === 0) {
    return {
      valid: false,
      error: "No valid users found in the provided list.",
      solution:
        "Provide user mentions (<@123456789>) or user IDs (123456789) separated by commas or spaces.",
      invalidUsers,
    };
  }

  return {
    valid: true,
    validUsers,
    invalidUsers: invalidUsers.length > 0 ? invalidUsers : undefined,
  };
}

/**
 * Generate a unique case ID
 * @returns {string} Case ID (format: MOD-YYYYMMDD-HHMMSS-RANDOM)
 */
function generateCaseId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MOD-${dateStr}-${timeStr}-${random}`;
}
