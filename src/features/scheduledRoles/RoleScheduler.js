import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  bulkAddRoles,
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";
import { getNextExecutionTime } from "../../commands/admin/schedule-role/utils.js";
import { getRoleExecutor } from "./RoleExecutor.js";
import {
  getUsersCorePriority,
  sortByCorePriority,
  logPriorityDistribution,
} from "../../commands/general/core/utils.js";

class RoleScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.recurringInterval = null;
    this.isRunning = false;
    this.lastCheckTime = 0;
    this.checkCooldown = 30000; // 30 seconds between checks (reduced for faster execution)
  }

  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Role scheduler is already running");
      return;
    }

    this.logger.info("🕐 Starting role scheduler...");
    this.isRunning = true;

    // Check for one-time schedules every 30 seconds for faster execution
    this.interval = setInterval(async () => {
      try {
        await this.executeDueSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (one-time)", error);
      }
    }, 30000).unref(); // 30 seconds

    // Check for recurring schedules every 5 minutes
    this.recurringInterval = setInterval(async () => {
      try {
        await this.executeRecurringSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (recurring)", error);
      }
    }, 300000).unref(); // 5 minutes

    this.logger.success(
      "✅ Role scheduler started (one-time: every 30s, recurring: every 5min)",
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
    this.logger.info(`Found ${dueSchedules.length} due scheduled role(s).`);

    if (dueSchedules.length === 0) {
      return;
    }

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
    this.logger.info(
      `Found ${activeSchedules.length} active recurring schedule(s).`,
    );

    if (activeSchedules.length === 0) {
      return;
    }

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
      // Calculate next execution time
      const nextExecution = getNextExecutionTime(scheduleConfig, scheduleType);

      if (!nextExecution) {
        return false;
      }

      // Check if it's time to execute (allow 5 minute window)
      const timeDiff = now.getTime() - nextExecution.getTime();
      const windowMs = 5 * 60 * 1000; // 5 minutes

      // Check if we haven't executed recently (avoid duplicate executions)
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

      // For custom intervals, check based on last execution time
      if (scheduleType === "custom") {
        if (!lastExecutedAt) {
          // First execution - execute now if enough time has passed since creation
          const createdAt = new Date(schedule.createdAt);
          const intervalMs = (scheduleConfig.intervalMinutes || 60) * 60 * 1000;
          return now.getTime() - createdAt.getTime() >= intervalMs;
        }

        const intervalMs = (scheduleConfig.intervalMinutes || 60) * 60 * 1000;
        const nextExecutionTime = lastExecutedAt.getTime() + intervalMs;
        return now.getTime() >= nextExecutionTime;
      }

      // For daily, weekly, monthly - check if within execution window
      return timeDiff >= 0 && timeDiff <= windowMs;
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
        `Guild ${schedule.guildId} not found, skipping schedule ${schedule.id}`,
      );
      return;
    }

    const role = guild.roles.cache.get(schedule.roleId);
    if (!role) {
      this.logger.warn(
        `Role ${schedule.roleId} not found in guild ${guild.name}, skipping schedule ${schedule.id}`,
      );
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
            this.logger.warn(
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
          this.logger.warn(`Member ${userId} not found in guild ${guild.name}`);
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
