import { v4 as uuidv4 } from "uuid";

import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

/**
 * Adds a temporary role to a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} expiresAt
 * @param {import("discord.js").Client} [client] Discord client for role assignment
 * @param {boolean} [notifyExpiry] Whether to send DM when role expires
 * @returns {Promise<boolean>}
 */
export async function addTemporaryRole(
  guildId,
  userId,
  roleId,
  expiresAt,
  client = null,
  notifyExpiry = false,
) {
  const logger = getLogger();
  try {
    // First, try to assign the Discord role to the user
    try {
      // Get the guild and member
      const guild = client?.guilds?.cache?.get(guildId);
      if (!guild) {
        logger.error(
          `Guild ${guildId} not found for temporary role assignment`,
        );
        return false;
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        logger.error(`Member ${userId} not found in guild ${guildId}`);
        return false;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        logger.error(`Role ${roleId} not found in guild ${guildId}`);
        return false;
      }

      // Check if user already has the role
      if (member.roles.cache.has(roleId)) {
        logger.info(`User ${userId} already has role ${role.name}`);
        // Don't return early - still need to store in database
      }

      // Assign the role only if user doesn't already have it
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(
          role,
          `Temporary role assignment - expires at ${expiresAt.toISOString()}`,
        );
        logger.info(
          `✅ Successfully assigned temporary role ${role.name} to user ${userId}`,
        );
      } else {
        logger.info(
          `✅ User ${userId} already has role ${role.name}, skipping Discord assignment`,
        );
      }
    } catch (discordError) {
      logger.error(
        `Failed to assign Discord role to user ${userId}:`,
        discordError,
      );
      // If Discord assignment fails, don't store in database
      return false;
    }

    // Only store in database if Discord assignment succeeded
    const storageManager = await getStorageManager();
    const storageResult = await storageManager.addTemporaryRole(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );

    if (!storageResult) {
      logger.error(
        `Failed to store temporary role in database for user ${userId}`,
      );
      // If storage fails, we should remove the Discord role we just assigned
      try {
        const guild = client?.guilds?.cache?.get(guildId);
        if (guild) {
          const member = await guild.members.fetch(userId);
          const role = guild.roles.cache.get(roleId);
          if (member && role) {
            await member.roles.remove(
              role,
              "Failed to store temporary role in database",
            );
            logger.info(
              `Removed Discord role ${role.name} from user ${userId} due to storage failure`,
            );
          }
        }
      } catch (cleanupError) {
        logger.error(
          "Failed to cleanup Discord role after storage failure:",
          cleanupError,
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Failed to add temporary role", error);
    return false;
  }
}

/**
 * Adds a supporter role to a user (permanent supporter role).
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} assignedAt
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function addSupporter(
  guildId,
  userId,
  roleId,
  assignedAt,
  reason,
) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (!supporters[guildId]) {
      supporters[guildId] = {};
    }

    supporters[guildId][userId] = {
      roleId,
      assignedAt: assignedAt.toISOString(),
      reason,
      isActive: true,
    };

    await storageManager.setSupporters(supporters);
    logger.info(`Added supporter role for user ${userId} in guild ${guildId}`);
    return true;
  } catch (error) {
    logger.error("Failed to add supporter role", error);
    return false;
  }
}

/**
 * Removes a supporter role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function removeSupporter(guildId, userId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (supporters[guildId]?.[userId]) {
      delete supporters[guildId][userId];
      await storageManager.setSupporters(supporters);
      logger.info(
        `Removed supporter role for user ${userId} in guild ${guildId}`,
      );
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Failed to remove supporter role", error);
    return false;
  }
}

/**
 * Gets all supporters for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getSupporters(guildId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();
    const guildSupporters = supporters[guildId] || {};

    return Object.entries(guildSupporters).map(([userId, data]) => ({
      userId,
      roleId: data.roleId,
      assignedAt: new Date(data.assignedAt),
      reason: data.reason,
      isActive: data.isActive,
    }));
  } catch (error) {
    logger.error("Failed to get supporters", error);
    return [];
  }
}

/**
 * Removes a temporary role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @returns {Promise<boolean>}
 */
export async function removeTemporaryRole(guildId, userId, roleId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.removeTemporaryRole(guildId, userId, roleId);
  } catch (error) {
    logger.error("Failed to remove temporary role", error);
    return false;
  }
}

/**
 * Gets temporary roles for a specific user in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserTemporaryRoles(guildId, userId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    const userRoles = tempRoles[guildId]?.[userId] || {};

    // Convert to array format
    const rolesArray = [];
    for (const [roleId, roleData] of Object.entries(userRoles)) {
      rolesArray.push({
        guildId,
        userId,
        roleId,
        expiresAt: roleData.expiresAt,
        notifyExpiry: roleData.notifyExpiry || false,
      });
    }

    return rolesArray;
  } catch (error) {
    logger.error("Failed to get user temporary roles", error);
    return [];
  }
}

/**
 * Gets all temporary roles for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getTemporaryRoles(guildId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();

    const guildRoles = tempRoles[guildId] || {};

    // Convert to array format expected by the command
    const rolesArray = [];
    for (const [userId, userRoles] of Object.entries(guildRoles)) {
      for (const [roleId, roleData] of Object.entries(userRoles)) {
        rolesArray.push({
          guildId,
          userId,
          roleId,
          expiresAt: roleData.expiresAt,
          notifyExpiry: roleData.notifyExpiry || false,
        });
      }
    }

    return rolesArray;
  } catch (error) {
    logger.error("Failed to get temporary roles for guild", error);
    return [];
  }
}

/**
 * Parses a duration string (e.g., "1h30m") into milliseconds.
 * @param {string} durationStr
 * @returns {number|null}
 */
export function parseDuration(durationStr) {
  const regex = /(\d+)\s*(w|d|h|m)/g;
  let totalMs = 0;
  let match;
  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "w":
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
      case "d":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case "h":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "m":
        totalMs += value * 60 * 1000;
        break;
    }
  }
  return totalMs > 0 ? totalMs : null;
}

/**
 * Formats a duration string into a human-readable format.
 * @param {string} durationStr
 * @returns {string}
 */
export function formatDuration(durationStr) {
  const ms = parseDuration(durationStr);
  if (!ms) return "Invalid duration";

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/**
 * Formats the remaining time until a date.
 * @param {Date|string} expiresAt
 * @returns {string}
 */
export function formatRemainingTime(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  let remaining = "";
  if (days > 0) remaining += `${days}d `;
  if (hours > 0) remaining += `${hours}h `;
  if (minutes > 0) remaining += `${minutes}m`;
  return remaining.trim() || "Less than a minute";
}

/**
 * Schedule a temporary role to be assigned at a specific time
 * @param {string} guildId
 * @param {string[]} userIds
 * @param {string} roleId
 * @param {Date} scheduleTime
 * @param {string} duration
 * @param {string} reason
 * @param {string} scheduledBy
 * @returns {Promise<Object|null>}
 */
export async function scheduleTemporaryRole(
  guildId,
  userIds,
  roleId,
  scheduleTime,
  duration,
  reason,
  scheduledBy,
) {
  const logger = getLogger();
  try {
    logger.info("Getting storage manager...");
    const storageManager = await getStorageManager();
    logger.info("Storage manager obtained successfully");
    const scheduleId = uuidv4();

    const scheduledRole = {
      scheduleId,
      guildId,
      userIds,
      roleId,
      scheduleTime: scheduleTime.toISOString(),
      duration,
      reason,
      scheduledBy,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    // Store in scheduled roles collection
    await storageManager.write("scheduled_roles", {
      ...((await storageManager.read("scheduled_roles")) || {}),
      [scheduleId]: scheduledRole,
    });

    logger.info(
      `Scheduled temporary role ${roleId} for ${userIds.length} users in guild ${guildId}`,
    );
    return scheduledRole;
  } catch (error) {
    logger.error("Failed to schedule temporary role", error);
    return null;
  }
}

/**
 * Create a recurring temporary role schedule
 * @param {string} guildId
 * @param {string[]} userIds
 * @param {string} roleId
 * @param {Object} schedule
 * @param {string} duration
 * @param {string} reason
 * @param {string} createdBy
 * @returns {Promise<Object|null>}
 */
export async function createRecurringRoleSchedule(
  guildId,
  userIds,
  roleId,
  schedule,
  duration,
  reason,
  createdBy,
) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const scheduleId = uuidv4();

    const recurringSchedule = {
      scheduleId,
      guildId,
      userIds,
      roleId,
      schedule,
      duration,
      reason,
      createdBy,
      status: "pending",
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: calculateNextRun(schedule),
    };

    // Store in recurring schedules collection
    await storageManager.write("recurring_schedules", {
      ...((await storageManager.read("recurring_schedules")) || {}),
      [scheduleId]: recurringSchedule,
    });

    logger.info(
      `Created recurring role schedule ${scheduleId} for role ${roleId} in guild ${guildId}`,
    );
    return recurringSchedule;
  } catch (error) {
    logger.error("Failed to create recurring role schedule", error);
    return null;
  }
}

/**
 * Calculate the next run time for a recurring schedule
 * @param {Object} schedule
 * @returns {Date}
 */
function calculateNextRun(schedule) {
  const now = new Date();
  const nextRun = new Date(now);

  switch (schedule.type) {
    case "daily":
      nextRun.setHours(schedule.hour || 0, schedule.minute || 0, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case "weekly": {
      const daysUntilNext = (schedule.dayOfWeek - now.getDay() + 7) % 7;
      nextRun.setDate(now.getDate() + daysUntilNext);
      nextRun.setHours(schedule.hour || 0, schedule.minute || 0, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;
    }
    case "monthly":
      nextRun.setDate(schedule.dayOfMonth || 1);
      nextRun.setHours(schedule.hour || 0, schedule.minute || 0, 0, 0);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
    case "custom":
      // Custom interval in minutes
      nextRun.setMinutes(now.getMinutes() + (schedule.intervalMinutes || 60));
      break;
  }

  return nextRun;
}

/**
 * Validate and parse schedule time input
 * @param {string} timeInput
 * @returns {Date|null}
 */
export function validateScheduleTime(timeInput) {
  try {
    const input = timeInput.toLowerCase().trim();

    // Handle relative time expressions
    if (input.startsWith("in ")) {
      return parseRelativeTime(input.substring(3));
    }

    // Handle natural language
    if (input.includes("today")) {
      const today = new Date();
      const result = parseTimeOfDay(today, input);
      return result;
    }

    if (input.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return parseTimeOfDay(tomorrow, input);
    }

    if (input.includes("next ")) {
      return parseNextDay(input);
    }

    // Handle specific date formats
    if (input.includes("-") || input.includes("/")) {
      return new Date(input);
    }

    // Handle time only (assume today)
    if (input.includes(":") && !input.includes("-") && !input.includes("/")) {
      const today = new Date();
      const result = parseTimeOfDay(today, input);
      return result;
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Parse relative time expressions like "2 hours", "30 minutes"
 * @param {string} relativeTime
 * @returns {Date}
 */
function parseRelativeTime(relativeTime) {
  const now = new Date();
  const match = relativeTime.match(
    /^(\d+)\s*(second|minute|hour|day|week|month|year)s?$/i,
  );

  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "second":
      now.setSeconds(now.getSeconds() + amount);
      break;
    case "minute":
      now.setMinutes(now.getMinutes() + amount);
      break;
    case "hour":
      now.setHours(now.getHours() + amount);
      break;
    case "day":
      now.setDate(now.getDate() + amount);
      break;
    case "week":
      now.setDate(now.getDate() + amount * 7);
      break;
    case "month":
      now.setMonth(now.getMonth() + amount);
      break;
    case "year":
      now.setFullYear(now.getFullYear() + amount);
      break;
  }

  return now;
}

/**
 * Parse time of day like "9am", "2:30pm" or "22:15" (24-hour format)
 * @param {Date} date
 * @param {string} timeStr
 * @returns {Date}
 */
function parseTimeOfDay(date, timeStr) {
  // First try 12-hour format (9am, 2:30pm)
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3].toLowerCase();

    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    date.setHours(hour, minute, 0, 0);
    return date;
  }

  // Then try 24-hour format (22:15, 14:30)
  const time24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (time24Match) {
    const hour = parseInt(time24Match[1]);
    const minute = parseInt(time24Match[2]);

    // Validate 24-hour format
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      date.setHours(hour, minute, 0, 0);
      return date;
    }
  }

  return date;
}

/**
 * Parse next day expressions like "next friday 6pm"
 * @param {string} dayStr
 * @returns {Date}
 */
function parseNextDay(dayStr) {
  const dayMatch = dayStr.match(
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!dayMatch) return null;

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
  const hour = parseInt(dayMatch[2]);
  const minute = dayMatch[3] ? parseInt(dayMatch[3]) : 0;
  const period = dayMatch[4] ? dayMatch[4].toLowerCase() : "am";

  const now = new Date();
  const currentDay = now.getDay();
  let daysUntilTarget = (targetDay - currentDay + 7) % 7;
  if (daysUntilTarget === 0) daysUntilTarget = 7; // Next week

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);

  let targetHour = hour;
  if (period === "pm" && hour !== 12) targetHour += 12;
  if (period === "am" && hour === 12) targetHour = 0;

  targetDate.setHours(targetHour, minute, 0, 0);
  return targetDate;
}

/**
 * Format schedule time for display
 * @param {Date} date
 * @returns {string}
 */
export function formatScheduleTime(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day(s) and ${diffHours} hour(s) from now`;
  } else if (diffHours > 0) {
    return `${diffHours} hour(s) and ${diffMinutes} minute(s) from now`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute(s) from now`;
  } else {
    return "Now";
  }
}

/**
 * Get all scheduled roles for a guild
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getScheduledRoles(guildId) {
  try {
    const storageManager = await getStorageManager();
    const scheduledRoles = (await storageManager.read("scheduled_roles")) || {};

    return Object.values(scheduledRoles).filter(
      role => role.guildId === guildId,
    );
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to get scheduled roles", error);
    return [];
  }
}

/**
 * Get all recurring schedules for a guild
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getRecurringSchedules(guildId) {
  try {
    const storageManager = await getStorageManager();
    const recurringSchedules =
      (await storageManager.read("recurring_schedules")) || {};

    return Object.values(recurringSchedules).filter(
      schedule => schedule.guildId === guildId,
    );
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to get recurring schedules", error);
    return [];
  }
}

/**
 * Cancel a scheduled role
 * @param {string} scheduleId
 * @returns {Promise<boolean>}
 */
export async function cancelScheduledRole(scheduleId) {
  try {
    const storageManager = await getStorageManager();
    const scheduledRoles = (await storageManager.read("scheduled_roles")) || {};

    if (scheduledRoles[scheduleId]) {
      scheduledRoles[scheduleId].status = "cancelled";
      await storageManager.write("scheduled_roles", scheduledRoles);
      return true;
    }

    return false;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to cancel scheduled role", error);
    return false;
  }
}

/**
 * Cancel a recurring schedule
 * @param {string} scheduleId
 * @returns {Promise<boolean>}
 */
export async function cancelRecurringSchedule(scheduleId) {
  try {
    const storageManager = await getStorageManager();
    const recurringSchedules =
      (await storageManager.read("recurring_schedules")) || {};

    if (recurringSchedules[scheduleId]) {
      recurringSchedules[scheduleId].status = "cancelled";
      await storageManager.write("recurring_schedules", recurringSchedules);
      return true;
    }

    return false;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to cancel recurring schedule", error);
    return false;
  }
}

/**
 * Process scheduled roles that are due
 * @returns {Promise<Array>}
 */
export async function processScheduledRoles() {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const scheduledRoles = (await storageManager.read("scheduled_roles")) || {};
    const now = new Date();
    const dueRoles = [];

    for (const [scheduleId, role] of Object.entries(scheduledRoles)) {
      // Only process roles that are scheduled and actually due
      if (role.status === "scheduled") {
        const scheduleTime = new Date(role.scheduleTime);
        const timeUntil = scheduleTime - now;

        // Only process if it's actually time (within 1 minute tolerance)
        if (timeUntil <= 60000 && timeUntil > -60000) {
          // ±1 minute tolerance
          logger.debug(
            `Role ${scheduleId} is due for assignment (${Math.round(timeUntil / 1000)}s)`,
          );
          dueRoles.push({ scheduleId, ...role });
        } else if (timeUntil > 60000) {
          logger.debug(
            `Role ${scheduleId} is not yet due (${Math.round(timeUntil / 1000)}s until due)`,
          );
        } else {
          logger.debug(
            `Role ${scheduleId} is overdue (${Math.round(timeUntil / 1000)}s overdue)`,
          );
        }
      }
    }

    return dueRoles;
  } catch (error) {
    logger.error("Failed to process scheduled roles", error);
    return [];
  }
}

/**
 * Process recurring schedules that are due
 * @returns {Promise<Array>}
 */
export async function processRecurringSchedules() {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const recurringSchedules =
      (await storageManager.read("recurring_schedules")) || {};
    const now = new Date();
    const dueSchedules = [];

    for (const [scheduleId, schedule] of Object.entries(recurringSchedules)) {
      // Process pending schedules that are due, or active schedules that need to run again
      if (
        (schedule.status === "pending" || schedule.status === "active") &&
        schedule.nextRun &&
        new Date(schedule.nextRun) <= now
      ) {
        logger.debug(`Recurring schedule ${scheduleId} is due for execution`);
        dueSchedules.push({ scheduleId, ...schedule });
      }
    }

    return dueSchedules;
  } catch (error) {
    logger.error("Failed to process recurring schedules", error);
    return [];
  }
}

/**
 * Find a schedule by ID (supports both full and shortened formats)
 * @param {string} scheduleId - Full ID or shortened format like "2802a998...7f7a"
 * @returns {Promise<Object|null>}
 */
export async function findScheduleById(scheduleId) {
  try {
    const storageManager = await getStorageManager();
    const scheduledRoles = (await storageManager.read("scheduled_roles")) || {};
    const recurringSchedules =
      (await storageManager.read("recurring_schedules")) || {};

    // First try exact match
    if (scheduledRoles[scheduleId]) {
      return { ...scheduledRoles[scheduleId], type: "scheduled" };
    }
    if (recurringSchedules[scheduleId]) {
      return { ...recurringSchedules[scheduleId], type: "recurring" };
    }

    // If no exact match, try shortened format
    const shortenedId = scheduleId.replace(/\.\.\./g, "");

    // Search in scheduled roles
    for (const [id, role] of Object.entries(scheduledRoles)) {
      if (id.includes(shortenedId)) {
        return { ...role, type: "scheduled" };
      }
    }

    // Search in recurring schedules
    for (const [id, schedule] of Object.entries(recurringSchedules)) {
      if (id.includes(shortenedId)) {
        return { ...schedule, type: "recurring" };
      }
    }

    return null;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to find schedule by ID", error);
    return null;
  }
}

/**
 * Cancel any type of schedule (scheduled or recurring)
 * @param {string} scheduleId
 * @returns {Promise<boolean>}
 */
export async function cancelSchedule(scheduleId) {
  try {
    const schedule = await findScheduleById(scheduleId);

    if (!schedule) {
      return false;
    }

    if (schedule.type === "scheduled") {
      return await cancelScheduledRole(scheduleId);
    } else if (schedule.type === "recurring") {
      return await cancelRecurringSchedule(scheduleId);
    }

    return false;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to cancel schedule", error);
    return false;
  }
}
