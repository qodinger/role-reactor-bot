import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

import { v4 as uuidv4 } from "uuid";

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
      status: "active",
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
    console.log(`[DEBUG] validateScheduleTime input: "${input}"`);

    // Handle relative time expressions
    if (input.startsWith("in ")) {
      return parseRelativeTime(input.substring(3));
    }

    // Handle natural language
    if (input.includes("today")) {
      const today = new Date();
      const result = parseTimeOfDay(today, input);
      console.log(`[DEBUG] today parseTimeOfDay result:`, result);
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
      console.log(`[DEBUG] parseTimeOfDay result:`, result);
      return result;
    }

    console.log(`[DEBUG] validateScheduleTime result: null`);
    return null;
  } catch (_error) {
    console.log(`[DEBUG] validateScheduleTime error:`, _error);
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
      if (role.status === "scheduled" && new Date(role.scheduleTime) <= now) {
        dueRoles.push({ scheduleId, ...role });
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
      if (schedule.status === "active" && new Date(schedule.nextRun) <= now) {
        dueSchedules.push({ scheduleId, ...schedule });
      }
    }

    return dueSchedules;
  } catch (error) {
    logger.error("Failed to process recurring schedules", error);
    return [];
  }
}
