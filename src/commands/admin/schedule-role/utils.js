import dedent from "dedent";
import { getLogger } from "../../../utils/logger.js";
import {
  parseOneTimeSchedule,
  parseRecurringSchedule,
} from "../../../utils/scheduleParser.js";
import { processUserList as baseProcessUserList } from "../temp-roles/utils.js";

/**
 * Detect the targeting type from users string
 * Supports mixed mentions: users + roles, multiple roles, or @everyone
 *
 * DISCORD MENTION FORMATS:
 * - User mentions: <@123456789> or <@!123456789> (the ! indicates nickname mention)
 *   Pattern: <@!?\d+> where !? means "!" is optional
 *
 * - Role mentions: <@&123456789> (the & distinguishes it from user mentions)
 *   Pattern: <@&\d+> where & is required
 *
 * - Role names: @RoleName (plain text format, no angle brackets)
 *   This is a role name lookup, not a mention format
 *
 * - User IDs: 123456789012345678 (plain 17-19 digit number)
 *   Pattern: /^\d{17,19}$/
 *
 * @param {string} usersString - The users string to parse
 * @param {import('discord.js').Guild} guild - The guild
 * @returns {Object} {type: 'everyone'|'role'|'users'|'mixed', targetRoles?: Role[], isAllMembers?: boolean, hasUsers?: boolean}
 */
export function detectTargetingType(usersString, guild) {
  if (!usersString || !guild) {
    return { type: "users" };
  }

  const trimmed = usersString.trim().toLowerCase();

  // Check for @everyone (must be exact match - cannot mix with others)
  if (trimmed === "@everyone" || trimmed === "everyone" || trimmed === "all") {
    return { type: "everyone", isAllMembers: true };
  }

  // DETECT USER MENTIONS:
  // Pattern: <@123456789> or <@!123456789>
  // The !? means "!" is optional (used for nickname mentions)
  // This pattern matches: <@ followed by optional ! followed by digits >
  const userMentions = usersString.match(/<@!?\d+>/g) || [];
  // Also check for plain user IDs (17-19 digit numbers)
  const hasUsers =
    userMentions.length > 0 || /^\d{17,19}/.test(usersString.trim());

  // DETECT ROLE MENTIONS:
  // Pattern: <@&123456789>
  // The & character is the key differentiator - it's REQUIRED for role mentions
  // This distinguishes role mentions from user mentions
  const targetRoles = [];

  // Find all role mentions in format <@&roleId>
  // Pattern: <@& followed by digits (captured in group 1) >
  const roleMentionMatches = usersString.matchAll(/<@&(\d+)>/g);
  for (const match of roleMentionMatches) {
    const roleId = match[1]; // Extract role ID from regex capture group
    const role = guild.roles.cache.get(roleId);
    if (role && !targetRoles.find(r => r.id === role.id)) {
      targetRoles.push(role);
    }
  }

  // Find role names starting with @ (text format, not mention format)
  // We need to find all @RoleName patterns in the string
  // Split by common delimiters (comma, semicolon) first, then handle spaces
  let parts = usersString.split(/(?<!<@)\s*[,;]\s*(?!@&\d+>)/).filter(Boolean);

  // Also split each part by spaces to handle space-separated role names
  // But be careful not to split user/role mentions
  const expandedParts = [];
  for (const part of parts) {
    // If the part contains spaces and is not a mention format, split by spaces
    if (
      part.includes(" ") &&
      !part.match(/^<@[!&]?\d+>$/) && // Not a mention format
      !part.match(/^\d{17,19}$/) // Not a plain user ID
    ) {
      // Split by spaces, but preserve whole mentions
      const spaceParts = part.split(/\s+/).filter(Boolean);
      expandedParts.push(...spaceParts);
    } else {
      expandedParts.push(part);
    }
  }

  parts = expandedParts;

  for (const part of parts) {
    const trimmedPart = part.trim();

    // Skip if it's already detected:
    // - Role mention (<@&roleId>) - already found above
    // - User mention (<@!?userId>) - detected as user
    // - Plain user ID (17-19 digits) - detected as user
    // - @everyone keyword - already handled
    if (
      trimmedPart.match(/^<@&\d+>$/) || // Role mention format
      trimmedPart.match(/^<@!?\d+>$/) || // User mention format
      /^\d{17,19}$/.test(trimmedPart) || // Plain user ID
      trimmedPart.toLowerCase() === "@everyone" ||
      trimmedPart.toLowerCase() === "everyone" ||
      trimmedPart.toLowerCase() === "all"
    ) {
      continue;
    }

    // Check if it's a role name starting with @ (not a user mention)
    // Examples: @VerifiedRole, @PremiumRole
    // We check:
    // 1. Starts with @
    // 2. Is NOT a user mention format (@!?digits)
    // 3. Matches a role name in the guild
    if (trimmedPart.startsWith("@") && !trimmedPart.match(/^@!?\d+$/)) {
      const roleName = trimmedPart.slice(1).trim(); // Remove @ prefix
      const role = guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase(),
      );
      if (role && !targetRoles.find(r => r.id === role.id)) {
        targetRoles.push(role);
      }
    }
  }

  // Determine targeting type based on what we found
  // Note: If we detected role mention format (<@&roleId>) but the role wasn't found,
  // we should still treat it as role type (even with empty targetRoles array)
  const hasRoleMentions = usersString.match(/<@&\d+>/g) !== null;

  if (hasUsers && (targetRoles.length > 0 || hasRoleMentions)) {
    // Mixed: both users and roles
    return { type: "mixed", targetRoles, hasUsers: true };
  } else if (targetRoles.length > 0 || hasRoleMentions) {
    // Only roles (even if not found in cache, format was detected)
    return { type: "role", targetRoles };
  } else if (hasUsers) {
    // Only users
    return { type: "users", hasUsers: true };
  }

  // Default: treat as user mentions/list
  return { type: "users" };
}

/**
 * Validate if a role can be assigned
 */
export function validateRole(role, guild) {
  // Don't assign managed roles
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
 * Process user list (reuse from temp-roles)
 */
export async function processUserList(usersString, interaction) {
  return baseProcessUserList(usersString, interaction);
}

/**
 * Validate and parse schedule
 */
export async function validateSchedule(scheduleType, scheduleInput) {
  const logger = getLogger();

  try {
    if (scheduleType === "one-time") {
      const parsedDate = parseOneTimeSchedule(scheduleInput);

      if (!parsedDate) {
        return {
          valid: false,
          error: `Invalid schedule format: **${scheduleInput}**`,
          solution: dedent`
            Use formats like: \`10:30\` (today), \`tomorrow 8am\`, \`friday 2pm\`, \`in 2 hours\`, \`next week\`, etc.
          `,
        };
      }

      // Check if date is in the past
      const now = new Date();
      if (parsedDate <= now) {
        return {
          valid: false,
          error: "The scheduled time must be in the future.",
          solution: "Use a future date/time for the schedule.",
        };
      }

      return {
        valid: true,
        scheduledAt: parsedDate,
      };
    } else if (scheduleType === "daily") {
      const parsed = parseRecurringSchedule("daily", scheduleInput);
      if (!parsed) {
        return {
          valid: false,
          error: `Invalid daily schedule format: **${scheduleInput}**`,
          solution: "Use formats like: `9am`, `14:30`, `2pm`, etc.",
        };
      }

      return {
        valid: true,
        scheduleConfig: parsed,
      };
    } else if (scheduleType === "weekly") {
      const parsed = parseRecurringSchedule("weekly", scheduleInput);
      if (!parsed) {
        return {
          valid: false,
          error: `Invalid weekly schedule format: **${scheduleInput}**`,
          solution: dedent`
            Use formats like: \`monday 9am\`, \`friday 2pm\`, \`sunday 10:00\`, etc.
          `,
        };
      }

      return {
        valid: true,
        scheduleConfig: parsed,
      };
    } else if (scheduleType === "monthly") {
      const parsed = parseRecurringSchedule("monthly", scheduleInput);
      if (!parsed) {
        return {
          valid: false,
          error: `Invalid monthly schedule format: **${scheduleInput}**`,
          solution:
            "Use formats like: `15 9am`, `1 2pm`, `30 14:30` (day of month + time), etc.",
        };
      }

      return {
        valid: true,
        scheduleConfig: parsed,
      };
    } else if (scheduleType === "custom") {
      const minutes = parseInt(scheduleInput, 10);
      if (isNaN(minutes) || minutes < 1 || minutes > 10080) {
        return {
          valid: false,
          error: `Invalid custom interval: **${scheduleInput}**`,
          solution: "Provide a number of minutes between 1 and 10080 (1 week).",
        };
      }

      return {
        valid: true,
        scheduleConfig: {
          interval: minutes,
          unit: "minutes",
        },
      };
    } else {
      return {
        valid: false,
        error: `Unknown schedule type: **${scheduleType}**`,
        solution: "Use one of: one-time, daily, weekly, monthly, custom",
      };
    }
  } catch (error) {
    logger.error("Error validating schedule:", error);
    return {
      valid: false,
      error: `Failed to parse schedule: **${scheduleInput}**`,
      solution: "Check the schedule format and try again.",
    };
  }
}

/**
 * Get next execution time for recurring schedule
 */
export function getNextExecutionTime(scheduleConfig, scheduleType) {
  try {
    if (scheduleType === "daily") {
      return parseRecurringSchedule(scheduleConfig.time || "00:00", "daily")
        ?.nextExecution;
    } else if (scheduleType === "weekly") {
      const scheduleStr = `${scheduleConfig.day} ${scheduleConfig.time || "00:00"}`;
      return parseRecurringSchedule(scheduleStr, "weekly")?.nextExecution;
    } else if (scheduleType === "monthly") {
      const scheduleStr = `${scheduleConfig.day} ${scheduleConfig.time || "00:00"}`;
      return parseRecurringSchedule(scheduleStr, "monthly")?.nextExecution;
    } else if (scheduleType === "custom") {
      const interval = scheduleConfig.interval || 60;
      return new Date(Date.now() + interval * 60 * 1000);
    }
    return null;
  } catch (error) {
    getLogger().error("Error calculating next execution time:", error);
    return null;
  }
}

/**
 * Format schedule time for display
 */
export function formatScheduleTime(date) {
  if (!date) return "Invalid date";

  try {
    // Handle string dates (from database) by converting to Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      getLogger().error("Invalid date provided to formatScheduleTime:", date);
      return "Invalid date";
    }

    const timestamp = Math.floor(dateObj.getTime() / 1000);
    return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
  } catch (error) {
    getLogger().error("Error formatting schedule time:", error);
    return "Invalid date";
  }
}

/**
 * Format recurring schedule for display
 */
export function formatRecurringSchedule(scheduleConfig) {
  try {
    if (scheduleConfig.interval && scheduleConfig.unit === "minutes") {
      const hours = Math.floor(scheduleConfig.interval / 60);
      const minutes = scheduleConfig.interval % 60;
      if (hours > 0 && minutes > 0) {
        return `Every ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `Every ${hours} hour${hours !== 1 ? "s" : ""}`;
      } else {
        return `Every ${minutes} minute${minutes !== 1 ? "s" : ""}`;
      }
    } else if (scheduleConfig.type === "daily") {
      return `Daily at ${scheduleConfig.time || "00:00"}`;
    } else if (scheduleConfig.type === "weekly") {
      const day =
        scheduleConfig.day.charAt(0).toUpperCase() +
        scheduleConfig.day.slice(1);
      return `Weekly on ${day} at ${scheduleConfig.time || "00:00"}`;
    } else if (scheduleConfig.type === "monthly") {
      return `Monthly on day ${scheduleConfig.day} at ${scheduleConfig.time || "00:00"}`;
    }
    return "Invalid schedule";
  } catch (error) {
    getLogger().error("Error formatting recurring schedule:", error);
    return "Invalid schedule";
  }
}
