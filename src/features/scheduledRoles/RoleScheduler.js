import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  bulkAddRoles,
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";

import { getRoleExecutor } from "./RoleExecutor.js";
import {
  getUsersCorePriority,
  sortByCorePriority,
  logPriorityDistribution,
} from "../../commands/general/balance/utils.js";

/**
 * Calculate the most recent past occurrence of a recurring schedule.
 * Unlike getNextExecutionTime (which always returns a future date), this
 * returns the scheduled time that has already passed so we can check whether
 * we're within the 5-minute execution window.
 *
 * @param {Object} scheduleConfig - The parsed schedule configuration
 * @param {string} scheduleType  - "daily" | "weekly" | "monthly"
 * @param {Date}   now           - Reference point (usually new Date())
 * @returns {Date|null} The most recent past occurrence, or null on error
 */
function getLastOccurrenceTime(scheduleConfig, scheduleType, now) {
  try {
    if (scheduleType === "daily") {
      const hour = scheduleConfig.hour ?? 0;
      const minute = scheduleConfig.minute ?? 0;

      const occurrence = new Date(now);
      occurrence.setHours(hour, minute, 0, 0);

      // If today's occurrence is still in the future, use yesterday's
      if (occurrence > now) {
        occurrence.setDate(occurrence.getDate() - 1);
      }

      return occurrence;
    } else if (scheduleType === "weekly") {
      const dayOfWeek = scheduleConfig.dayOfWeek ?? 0;
      const hour = scheduleConfig.hour ?? 0;
      const minute = scheduleConfig.minute ?? 0;

      const occurrence = new Date(now);
      occurrence.setHours(hour, minute, 0, 0);

      const currentDay = now.getDay();
      let daysBack = currentDay - dayOfWeek;

      if (daysBack < 0) {
        daysBack += 7; // target day was earlier this week (wrap to last week)
      }

      occurrence.setDate(now.getDate() - daysBack);

      // If we ended up in the future (same day but time hasn't passed yet),
      // go back one full week.
      if (occurrence > now) {
        occurrence.setDate(occurrence.getDate() - 7);
      }

      return occurrence;
    } else if (scheduleType === "monthly") {
      const dayOfMonth = scheduleConfig.dayOfMonth ?? 1;
      const hour = scheduleConfig.hour ?? 0;
      const minute = scheduleConfig.minute ?? 0;

      const occurrence = new Date(now);
      occurrence.setDate(dayOfMonth);
      occurrence.setHours(hour, minute, 0, 0);

      // If this month's occurrence is still in the future, use last month's
      if (occurrence > now) {
        occurrence.setMonth(occurrence.getMonth() - 1);
        // Handle edge cases (e.g. day 31 in a 30-day month)
        if (occurrence.getDate() !== dayOfMonth) {
          occurrence.setDate(0); // last day of the month before
        }
      }

      return occurrence;
    }

    return null;
  } catch (error) {
    getLogger().error("Error calculating last occurrence time:", error);
    return null;
  }
}

class RoleScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.recurringInterval = null;
    this.isRunning = false;
    this.lastCheckTime = 0;
    this.checkCooldown = 5000; // 5 seconds between checks to allow 10s intervals
  }

  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Role scheduler is already running");
      return;
    }

    this.logger.info("🕐 Starting role scheduler...");
    this.isRunning = true;

    // Check for one-time schedules every 10 seconds for faster execution
    this.interval = setInterval(async () => {
      try {
        await this.executeDueSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (one-time)", error);
      }
    }, 10000).unref(); // 10 seconds

    // Check for recurring schedules every 10 seconds
    this.recurringInterval = setInterval(async () => {
      try {
        await this.executeRecurringSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (recurring)", error);
      }
    }, 10000).unref(); // 10 seconds

    this.logger.success(
      "✅ Role scheduler started (checks every 10s for exact timing)",
    );
    this.logger.info("🕐 Running initial schedule check...");
    this.executeDueSchedules();
    this.executeRecurringSchedules();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.recurringInterval) {
      clearInterval(this.recurringInterval);
      this.recurringInterval = null;
    }
    this.isRunning = false;
    this.logger.info("🛑 Role scheduler stopped");
  }

  async executeDueSchedules() {
    const now = Date.now();

    // Prevent multiple executions from running simultaneously
    if (now - this.lastCheckTime < this.checkCooldown) {
      this.logger.debug("Schedule check skipped - too soon since last run");
      return;
    }

    this.lastCheckTime = now;

    const databaseManager = await getDatabaseManager();
    if (!databaseManager?.scheduledRoles) {
      this.logger.debug("Database not ready, skipping schedule execution.");
      return;
    }

    this.logger.debug("🕐 Checking for due scheduled roles...");

    const dueSchedules = await databaseManager.scheduledRoles.findDue();

    if (dueSchedules.length === 0) {
      this.logger.debug("No due scheduled roles.");
      return;
    }

    this.logger.info(`Found ${dueSchedules.length} due scheduled role(s).`);

    // Group by guild for efficient processing
    const guildGroups = new Map();
    for (const schedule of dueSchedules) {
      const { guildId } = schedule;
      if (!guildGroups.has(guildId)) {
        guildGroups.set(guildId, []);
      }
      guildGroups.get(guildId).push(schedule);
    }

    // Sort guilds by Core member priority
    const prioritizedGuilds = await this.prioritizeGuildsByCoreMembers(
      Array.from(guildGroups.entries()),
    );

    // Process each guild's schedules in priority order
    for (const { guildId, schedules } of prioritizedGuilds) {
      await this.processGuildSchedules(guildId, schedules, databaseManager);
    }
  }

  async executeRecurringSchedules() {
    const databaseManager = await getDatabaseManager();
    if (!databaseManager?.recurringSchedules) {
      this.logger.debug(
        "Database not ready, skipping recurring schedule execution.",
      );
      return;
    }

    this.logger.debug("🔄 Checking for recurring schedules to execute...");

    const activeSchedules =
      await databaseManager.recurringSchedules.findActive();

    if (activeSchedules.length === 0) {
      this.logger.debug("No active recurring schedules.");
      return;
    }

    this.logger.debug(
      `Found ${activeSchedules.length} active recurring schedule(s).`,
    );

    const now = new Date();

    // Filter schedules that should execute
    const schedulesToExecute = [];
    for (const schedule of activeSchedules) {
      try {
        const shouldExecute = await this.shouldExecuteRecurringSchedule(
          schedule,
          now,
        );

        if (shouldExecute) {
          schedulesToExecute.push(schedule);
        }
      } catch (error) {
        this.logger.error(
          `Error processing recurring schedule ${schedule.id}:`,
          error,
        );
      }
    }

    // Sort schedules by Core member priority
    const prioritizedSchedules =
      await this.prioritizeSchedulesByCoreMembers(schedulesToExecute);

    if (prioritizedSchedules.length > 0) {
      this.logger.info(
        `⚡ Executing ${prioritizedSchedules.length} recurring schedule(s).`,
      );
    }

    // Execute schedules in priority order
    for (const schedule of prioritizedSchedules) {
      try {
        await this.executeRecurringSchedule(schedule, databaseManager);
      } catch (error) {
        this.logger.error(
          `Error executing recurring schedule ${schedule.id}:`,
          error,
        );
      }
    }
  }

  async shouldExecuteRecurringSchedule(schedule, now) {
    const scheduleConfig = schedule.scheduleConfig;
    const scheduleType = schedule.scheduleType;

    if (!scheduleConfig) {
      return false;
    }

    try {
      // For custom intervals, check based on last execution time
      if (scheduleType === "custom") {
        const lastExecutedAt = schedule.lastExecutedAt
          ? new Date(schedule.lastExecutedAt)
          : null;
        const minIntervalMs = 60000; // 1 minute minimum between executions

        if (
          lastExecutedAt &&
          now.getTime() - lastExecutedAt.getTime() < minIntervalMs
        ) {
          return false;
        }

        if (!lastExecutedAt) {
          // First execution - execute now if enough time has passed since creation
          const createdAt = new Date(schedule.createdAt);
          const intervalMs =
            (scheduleConfig.intervalMinutes || scheduleConfig.interval || 60) *
            60 *
            1000;
          return now.getTime() - createdAt.getTime() >= intervalMs;
        }

        const intervalMs =
          (scheduleConfig.intervalMinutes || scheduleConfig.interval || 60) *
          60 *
          1000;
        const nextExecutionTime = lastExecutedAt.getTime() + intervalMs;
        return now.getTime() >= nextExecutionTime;
      }

      // For daily, weekly, monthly - calculate the most recent past occurrence
      // and check if we're within the execution window and haven't run since then.
      const lastOccurrence = getLastOccurrenceTime(
        scheduleConfig,
        scheduleType,
        now,
      );

      if (!lastOccurrence) {
        return false;
      }

      const windowMs = 5 * 60 * 1000; // 5 minutes

      // We must be within the execution window after the last scheduled occurrence
      const timeSinceOccurrence = now.getTime() - lastOccurrence.getTime();
      if (timeSinceOccurrence < 0 || timeSinceOccurrence > windowMs) {
        return false;
      }

      // Check we haven't already executed this occurrence
      const lastExecutedAt = schedule.lastExecutedAt
        ? new Date(schedule.lastExecutedAt)
        : null;
      const minIntervalMs = 60000; // 1 minute minimum between executions

      if (
        lastExecutedAt &&
        now.getTime() - lastExecutedAt.getTime() < minIntervalMs
      ) {
        return false;
      }

      // Ensure the last execution was before this occurrence (not for a previous cycle)
      if (lastExecutedAt && lastExecutedAt >= lastOccurrence) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error checking if recurring schedule should execute:`,
        error,
      );
      return false;
    }
  }

  async executeRecurringSchedule(schedule, databaseManager) {
    const guild = this.client.guilds.cache.get(schedule.guildId);
    if (!guild) {
      this.logger.warn(
        `Guild ${schedule.guildId} not found, deactivating recurring schedule ${schedule.id}`,
      );
      await databaseManager.recurringSchedules.cancel(schedule.id);
      return;
    }

    const role = guild.roles.cache.get(schedule.roleId);
    if (!role) {
      this.logger.warn(
        `Role ${schedule.roleId} not found in guild ${guild.name}, deactivating recurring schedule ${schedule.id}`,
      );
      await databaseManager.recurringSchedules.cancel(schedule.id);
      return;
    }

    const userIds = Array.isArray(schedule.userIds)
      ? schedule.userIds
      : [schedule.userId].filter(Boolean);

    this.logger.info(
      `Executing recurring schedule ${schedule.id}: ${schedule.action} role ${role.name} to ${userIds.length} user(s) in ${guild.name}`,
    );

    // Use optimized executor for large operations (>50 users)
    if (userIds.length > 50) {
      const executor = getRoleExecutor();
      const result = await executor.executeRoleOperation(
        guild,
        userIds,
        role,
        schedule.action,
        `Recurring schedule: ${schedule.reason || "No reason provided"}`,
      );

      this.logger.info(
        `✅ Recurring schedule ${schedule.id}: ${result.successCount} successful, ${result.failedCount} failed out of ${result.totalUsers} users`,
      );
    } else {
      // Use standard batch processing for smaller operations
      const operations = [];
      for (const userId of userIds) {
        try {
          const member = await getCachedMember(guild, userId);
          if (!member) {
            this.logger.debug(
              `Member ${userId} not found in guild ${guild.name}`,
            );
            continue;
          }

          if (schedule.action === "assign") {
            if (!member.roles.cache.has(role.id)) {
              operations.push({ member, role, action: "add" });
            }
          } else if (schedule.action === "remove") {
            if (member.roles.cache.has(role.id)) {
              operations.push({ member, role, action: "remove" });
            }
          }
        } catch (error) {
          this.logger.error(
            `Error processing user ${userId} for recurring schedule:`,
            error,
          );
        }
      }

      // Execute operations
      if (operations.length > 0) {
        const addOperations = operations.filter(op => op.action === "add");
        const removeOperations = operations.filter(
          op => op.action === "remove",
        );

        if (addOperations.length > 0) {
          const results = await bulkAddRoles(
            addOperations.map(op => ({ member: op.member, role: op.role })),
            `Recurring schedule: ${schedule.reason || "No reason provided"}`,
          );
          const successCount = results.filter(r => r.success).length;
          this.logger.success(
            `✅ Recurring schedule ${schedule.id}: Successfully assigned role to ${successCount}/${addOperations.length} user(s)`,
          );
        }

        if (removeOperations.length > 0) {
          const results = await bulkRemoveRoles(
            removeOperations.map(op => ({ member: op.member, role: op.role })),
            `Recurring schedule: ${schedule.reason || "No reason provided"}`,
          );
          const successCount = results.filter(r => r.success).length;
          this.logger.success(
            `✅ Recurring schedule ${schedule.id}: Successfully removed role from ${successCount}/${removeOperations.length} user(s)`,
          );
        }
      }
    }

    // Update last executed time
    await databaseManager.recurringSchedules.updateLastExecuted(
      schedule.id,
      new Date(),
    );
  }

  async processGuildSchedules(guildId, schedules, databaseManager) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      this.logger.warn(`Guild ${guildId} not found, cleaning up schedules.`);
      await this.cleanupSchedulesFromDB(schedules, databaseManager);
      return;
    }

    // Process each schedule
    for (const schedule of schedules) {
      await this.executeSchedule(schedule, guild, databaseManager);
    }
  }

  async executeSchedule(schedule, guild, databaseManager) {
    const role = guild.roles.cache.get(schedule.roleId);
    if (!role) {
      this.logger.warn(
        `Role ${schedule.roleId} not found in guild ${guild.name}, marking schedule ${schedule.id} as executed`,
      );
      await databaseManager.scheduledRoles.markExecuted(schedule.id);
      return;
    }

    const userIds = Array.isArray(schedule.userIds)
      ? schedule.userIds
      : [schedule.userId].filter(Boolean);

    this.logger.info(
      `Executing scheduled role ${schedule.action}: ${role.name} to ${userIds.length} user(s) in ${guild.name} (Schedule ID: ${schedule.id})`,
    );

    // Prepare role operations
    const operations = [];
    for (const userId of userIds) {
      try {
        const member = await getCachedMember(guild, userId);
        if (!member) {
          this.logger.debug(
            `Member ${userId} not found in guild ${guild.name}`,
          );
          continue;
        }

        if (schedule.action === "assign") {
          if (!member.roles.cache.has(role.id)) {
            operations.push({ member, role, action: "add" });
          }
        } else if (schedule.action === "remove") {
          if (member.roles.cache.has(role.id)) {
            operations.push({ member, role, action: "remove" });
          }
        }
      } catch (error) {
        this.logger.error(
          `Error processing user ${userId} for scheduled role:`,
          error,
        );
      }
    }

    // Use optimized executor for large operations (>50 users)
    if (userIds.length > 50) {
      const executor = getRoleExecutor();
      const result = await executor.executeRoleOperation(
        guild,
        userIds,
        role,
        schedule.action,
        `Scheduled role: ${schedule.reason || "No reason provided"}`,
      );

      this.logger.info(
        `✅ Schedule ${schedule.id}: ${result.successCount} successful, ${result.failedCount} failed out of ${result.totalUsers} users`,
      );
    } else if (operations.length > 0) {
      // Use standard batch processing for smaller operations
      const addOperations = operations.filter(op => op.action === "add");
      const removeOperations = operations.filter(op => op.action === "remove");

      if (addOperations.length > 0) {
        const results = await bulkAddRoles(
          addOperations.map(op => ({ member: op.member, role: op.role })),
          `Scheduled role: ${schedule.reason || "No reason provided"}`,
        );
        const successCount = results.filter(r => r.success).length;
        this.logger.success(
          `✅ Schedule ${schedule.id}: Successfully assigned role to ${successCount}/${addOperations.length} user(s)`,
        );
      }

      if (removeOperations.length > 0) {
        const results = await bulkRemoveRoles(
          removeOperations.map(op => ({ member: op.member, role: op.role })),
          `Scheduled role: ${schedule.reason || "No reason provided"}`,
        );
        const successCount = results.filter(r => r.success).length;
        this.logger.success(
          `✅ Schedule ${schedule.id}: Successfully removed role from ${successCount}/${removeOperations.length} user(s)`,
        );
      }
    }

    // Mark as executed
    await databaseManager.scheduledRoles.markExecuted(schedule.id);
  }

  async cleanupSchedulesFromDB(schedules, databaseManager) {
    for (const schedule of schedules) {
      try {
        await databaseManager.scheduledRoles.markExecuted(schedule.id);
      } catch (error) {
        this.logger.error(`Error cleaning up schedule ${schedule.id}:`, error);
      }
    }
  }

  /**
   * Check if any user in a schedule is a Core member and get highest tier
   * @param {Object} schedule - Schedule object
   * @returns {Promise<{hasCore: boolean, maxTier: string|null, priority: number}>}
   */
  async getScheduleCorePriority(schedule) {
    try {
      const userIds = Array.isArray(schedule.userIds)
        ? schedule.userIds
        : [schedule.userId].filter(Boolean);

      return await getUsersCorePriority(userIds, {
        maxUsers: 10,
        logger: this.logger,
      });
    } catch (error) {
      this.logger.error(
        `Error checking Core priority for schedule ${schedule.id}:`,
        error,
      );
      return { hasCore: false, maxTier: null, priority: 0 };
    }
  }

  /**
   * Prioritize schedules by Core member status
   * @param {Array} schedules - Array of schedules to prioritize
   * @returns {Promise<Array>} Sorted schedules (Core members first)
   */
  async prioritizeSchedulesByCoreMembers(schedules) {
    if (schedules.length === 0) {
      return [];
    }

    // Get Core priority for each schedule
    const schedulesWithPriority = await Promise.all(
      schedules.map(async schedule => {
        const corePriority = await this.getScheduleCorePriority(schedule);
        return {
          schedule,
          priority: corePriority.priority,
          tier: corePriority.maxTier,
        };
      }),
    );

    // Sort by priority (descending), then by schedule ID for consistency
    sortByCorePriority(schedulesWithPriority, "id");

    // Log priority distribution
    logPriorityDistribution(
      schedulesWithPriority,
      schedules.length,
      "schedules",
      this.logger,
    );

    return schedulesWithPriority.map(s => s.schedule);
  }

  /**
   * Prioritize guilds by Core member status in their schedules
   * @param {Array} guildEntries - Array of [guildId, schedules] tuples
   * @returns {Promise<Array>} Sorted guild entries (Core members first)
   */
  async prioritizeGuildsByCoreMembers(guildEntries) {
    if (guildEntries.length === 0) {
      return [];
    }

    // Get Core priority for each guild's schedules
    const guildsWithPriority = await Promise.all(
      guildEntries.map(async ([guildId, schedules]) => {
        let maxPriority = 0;
        let maxTier = null;

        // Check up to first 3 schedules per guild for Core members
        for (const schedule of schedules.slice(0, 3)) {
          const corePriority = await this.getScheduleCorePriority(schedule);
          if (corePriority.priority > maxPriority) {
            maxPriority = corePriority.priority;
            maxTier = corePriority.maxTier;
          }
        }

        return {
          guildId,
          schedules,
          priority: maxPriority,
          tier: maxTier,
        };
      }),
    );

    // Sort by priority (descending), then by guild ID for consistency
    sortByCorePriority(guildsWithPriority, "guildId");

    // Log priority distribution
    logPriorityDistribution(
      guildsWithPriority,
      guildEntries.length,
      "guilds",
      this.logger,
    );

    return guildsWithPriority;
  }
}

let scheduler = null;

export function getScheduler(client) {
  if (!scheduler) {
    scheduler = new RoleScheduler(client);
  }
  return scheduler;
}
