import { getStorageManager } from "../storage/storageManager.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import { getLogger } from "../logger.js";

/**
 * Generate a short, user-friendly schedule ID
 * @param {string} type - "scheduled" or "recurring"
 * @returns {string} Short ID like "SRA1B2C3" or "RSD4E5F6"
 */
function generateShortScheduleId(type = "scheduled") {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  // Generate 6 random characters
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Add prefix based on type (no dash)
  const prefix = type === "recurring" ? "RS" : "SR";
  return `${prefix}${result}`;
}

/**
 * Generate a unique short schedule ID
 * @param {string} type - "scheduled" or "recurring"
 * @param {Object} existingSchedules - Existing schedules to check against
 * @returns {Promise<string>} Unique short ID
 */
async function generateUniqueShortScheduleId(
  type = "scheduled",
  existingSchedules = {},
) {
  let attempts = 0;
  const maxAttempts = 1000; // Increased attempts since we have 56.8B combinations

  while (attempts < maxAttempts) {
    const id = generateShortScheduleId(type);

    // Check if ID already exists
    if (!existingSchedules[id]) {
      return id;
    }

    attempts++;
  }

  // This should never happen with 56.8B combinations, but if it does, throw an error
  throw new Error(
    `Failed to generate unique short ID after ${maxAttempts} attempts`,
  );
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

    // Get existing schedules to ensure uniqueness
    const existingSchedules =
      (await storageManager.read("scheduled_roles")) || {};
    const scheduleId = await generateUniqueShortScheduleId(
      "scheduled",
      existingSchedules,
    );

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

    // Use database manager directly
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      const success = await dbManager.scheduledRoles.create(scheduledRole);
      if (!success) {
        logger.error("Failed to create scheduled role in database");
        return null;
      }
    } else {
      logger.error("Database manager not available");
      return null;
    }

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

    // Get existing schedules to ensure uniqueness
    const existingSchedules =
      (await storageManager.read("recurring_schedules")) || {};
    const scheduleId = await generateUniqueShortScheduleId(
      "recurring",
      existingSchedules,
    );

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

    // Use database manager directly
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      const success =
        await dbManager.recurringSchedules.create(recurringSchedule);
      if (!success) {
        logger.error("Failed to create recurring schedule in database");
        return null;
      }
    } else {
      logger.error("Database manager not available");
      return null;
    }

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
export function calculateNextRun(schedule) {
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
 * Get all scheduled roles for a guild
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getScheduledRoles(guildId) {
  try {
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      // Read from database first
      const allScheduledRoles = await dbManager.scheduledRoles.getAll();
      return Object.values(allScheduledRoles).filter(
        role => role.guildId === guildId,
      );
    } else {
      // Fallback to file storage if database not available
      const storageManager = await getStorageManager();
      const scheduledRoles =
        (await storageManager.read("scheduled_roles")) || {};
      return Object.values(scheduledRoles).filter(
        role => role.guildId === guildId,
      );
    }
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
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      // Read from database first
      const allRecurringSchedules = await dbManager.recurringSchedules.getAll();
      return Object.values(allRecurringSchedules).filter(
        schedule => schedule.guildId === guildId,
      );
    } else {
      // Fallback to file storage if database not available
      const storageManager = await getStorageManager();
      const recurringSchedules =
        (await storageManager.read("recurring_schedules")) || {};

      return Object.values(recurringSchedules).filter(
        schedule => schedule.guildId === guildId,
      );
    }
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to get recurring schedules", error);
    return [];
  }
}

/**
 * Find a schedule by ID (supports mixed-case short IDs only)
 * @param {string} scheduleId - Short ID like "SRA1B2C3" or "RSD4E5F6"
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

    // If it's a short ID format (SRXXXXXX or RSXXXXXX), try partial match
    if (scheduleId.match(/^[SR]{2}[A-Za-z0-9]{1,6}$/)) {
      const prefix = scheduleId.substring(0, 2);
      const suffix = scheduleId.substring(2);

      // Search in scheduled roles
      for (const [id, role] of Object.entries(scheduledRoles)) {
        if (
          id.startsWith(scheduleId) ||
          (id.startsWith(prefix) && id.includes(suffix))
        ) {
          return { ...role, type: "scheduled" };
        }
      }

      // Search in recurring schedules
      for (const [id, schedule] of Object.entries(recurringSchedules)) {
        if (
          id.startsWith(scheduleId) ||
          (id.startsWith(prefix) && id.includes(suffix))
        ) {
          return { ...schedule, type: "recurring" };
        }
      }
    }

    // If still not found, try searching in the database
    try {
      const logger = getLogger();
      logger.debug("Searching database for schedule", {
        scheduleId,
      });

      const dbManager = await getDatabaseManager();
      if (dbManager) {
        logger.debug("Database manager available, searching...");

        // Search recurring schedules by exact ID
        const recurringSchedule =
          await dbManager.recurringSchedules.getById(scheduleId);
        if (recurringSchedule) {
          logger.debug("Found recurring schedule by exact ID", {
            scheduleId,
          });
          return { ...recurringSchedule, type: "recurring" };
        }

        // Search scheduled roles by exact ID
        const scheduledRole =
          await dbManager.scheduledRoles.getById(scheduleId);
        if (scheduledRole) {
          logger.debug("Found scheduled role by exact ID", { scheduleId });
          return { ...scheduledRole, type: "scheduled" };
        }

        // Try partial match in recurring schedules
        const allRecurring = await dbManager.recurringSchedules.getAll();
        logger.debug("Searching recurring schedules for partial match", {
          totalRecurring: Object.keys(allRecurring).length,
          scheduleId,
        });

        for (const [id, schedule] of Object.entries(allRecurring)) {
          const scheduleIdField = schedule.scheduleId || schedule.id;

          // Handle short ID format matching
          if (scheduleIdField.match(/^[SR]{2}[A-Za-z0-9]{6}$/)) {
            if (
              scheduleIdField === scheduleId ||
              scheduleIdField.startsWith(scheduleId.substring(0, 6))
            ) {
              logger.debug("Found recurring schedule by short ID match", {
                searchId: scheduleId,
                foundId: id,
                scheduleIdField,
              });
              return { ...schedule, type: "recurring" };
            }
          }
        }

        // Try partial match in scheduled roles
        const allScheduled = await dbManager.scheduledRoles.getAll();
        logger.debug("Searching scheduled roles for partial match", {
          totalScheduled: Object.keys(allScheduled).length,
          scheduleId,
        });

        for (const [id, role] of Object.entries(allScheduled)) {
          const scheduleIdField = role.scheduleId || role.id;

          // Handle short ID format matching
          if (scheduleIdField.match(/^[SR]{2}[A-Za-z0-9]{6}$/)) {
            if (
              scheduleIdField === scheduleId ||
              scheduleIdField.startsWith(scheduleId.substring(0, 6))
            ) {
              logger.debug("Found scheduled role by short ID match", {
                searchId: scheduleId,
                foundId: id,
                scheduleIdField,
              });
              return { ...role, type: "scheduled" };
            }
          }
        }

        logger.debug("No matching schedules found in database", {
          scheduleId,
        });
      } else {
        logger.debug("Database manager not available");
      }
    } catch (dbError) {
      const logger = getLogger();
      logger.debug(
        "Database search failed, continuing with file search",
        dbError,
      );
    }

    return null;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to find schedule by ID", error);
    return null;
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
    const logger = getLogger();
    const storageManager = await getStorageManager();

    logger.debug("Cancelling recurring schedule", { scheduleId });

    // Try database first if available
    try {
      const dbManager = await getDatabaseManager();
      if (dbManager) {
        // Find the schedule by scheduleId field in database
        const allRecurring = await dbManager.recurringSchedules.getAll();
        for (const [id, schedule] of Object.entries(allRecurring)) {
          if (schedule.scheduleId === scheduleId) {
            // Update status to cancelled
            const updateResult = await storageManager.updateRecurringSchedule(
              id,
              {
                status: "cancelled",
                updatedAt: new Date().toISOString(),
              },
            );

            if (updateResult) {
              logger.debug(
                "Successfully cancelled recurring schedule in database",
                {
                  scheduleId,
                  databaseId: id,
                },
              );
              return true;
            }
          }
        }
      }
    } catch (dbError) {
      logger.debug(
        "Database cancellation failed, falling back to file storage",
        {
          error: dbError.message,
        },
      );
    }

    // Fallback to file storage
    const recurringSchedules =
      (await storageManager.read("recurring_schedules")) || {};

    if (recurringSchedules[scheduleId]) {
      recurringSchedules[scheduleId].status = "cancelled";
      recurringSchedules[scheduleId].updatedAt = new Date().toISOString();
      await storageManager.write("recurring_schedules", recurringSchedules);
      logger.debug(
        "Successfully cancelled recurring schedule in file storage",
        { scheduleId },
      );
      return true;
    }

    logger.warn("Recurring schedule not found for cancellation", {
      scheduleId,
    });
    return false;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to cancel recurring schedule", error);
    return false;
  }
}

/**
 * Cancel any type of schedule (scheduled or recurring)
 * @param {string} scheduleId - The actual scheduleId from the database (not the search ID)
 * @returns {Promise<boolean>}
 */
export async function cancelSchedule(scheduleId) {
  try {
    // Use the actual scheduleId directly, don't search again
    const logger = getLogger();
    logger.debug("Cancelling schedule directly", { scheduleId });

    // Try to cancel as scheduled role first
    const scheduledSuccess = await cancelScheduledRole(scheduleId);
    if (scheduledSuccess) {
      logger.debug("Successfully cancelled as scheduled role", { scheduleId });
      return true;
    }

    // Try to cancel as recurring schedule
    const recurringSuccess = await cancelRecurringSchedule(scheduleId);
    if (recurringSuccess) {
      logger.debug("Successfully cancelled as recurring schedule", {
        scheduleId,
      });
      return true;
    }

    logger.warn("Failed to cancel schedule - not found in either collection", {
      scheduleId,
    });
    return false;
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to cancel schedule", error);
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
 * Updates an existing schedule
 * @param {string} scheduleId - Schedule ID to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<boolean>}
 */
export async function updateSchedule(scheduleId, updateData) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();

    // Determine if it's a scheduled role or recurring schedule
    const existingSchedule = await findScheduleById(scheduleId);
    if (!existingSchedule) {
      logger.error("Schedule not found for update", { scheduleId });
      return false;
    }

    // Update based on schedule type
    if (existingSchedule.type === "one-time") {
      return await storageManager.updateScheduledRole(scheduleId, updateData);
    } else {
      return await storageManager.updateRecurringSchedule(
        scheduleId,
        updateData,
      );
    }
  } catch (error) {
    logger.error("Failed to update schedule", error);
    return false;
  }
}
