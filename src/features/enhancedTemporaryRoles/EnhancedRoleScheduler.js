import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import {
  processScheduledRoles,
  processRecurringSchedules,
} from "../../utils/discord/enhancedTemporaryRoles.js";
import { addTemporaryRole } from "../../utils/discord/temporaryRoles.js";

/**
 * Enhanced Role Scheduler for handling scheduled and recurring temporary roles
 */
export class EnhancedRoleScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.isRunning = false;
    this.lastCleanupTime = 0;
    this.cleanupCooldown = 30000; // 30 seconds between cleanups
  }

  /**
   * Start the enhanced role scheduler
   */
  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Enhanced role scheduler is already running");
      return;
    }

    this.logger.info("🚀 Starting enhanced role scheduler...");
    this.isRunning = true;

    // Run every minute to check for scheduled and recurring roles
    this.interval = setInterval(async () => {
      try {
        this.logger.debug("🕐 Enhanced scheduler cleanup triggered");
        await this.processScheduledRoles();
        await this.processRecurringSchedules();
      } catch (error) {
        this.logger.error("❌ Error in enhanced role scheduler", error);
      }
    }, 60000).unref();

    this.logger.success(
      "✅ Enhanced role scheduler started (runs every 60 seconds)",
    );

    // Run initial cleanup
    this.processScheduledRoles();
    this.processRecurringSchedules();
  }

  /**
   * Stop the enhanced role scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.logger.info("🛑 Enhanced role scheduler stopped");
  }

  /**
   * Process scheduled roles that are due
   */
  async processScheduledRoles() {
    const now = Date.now();

    // Prevent multiple cleanups from running simultaneously
    if (now - this.lastCleanupTime < this.cleanupCooldown) {
      this.logger.debug(
        "Scheduled roles cleanup skipped - too soon since last run",
      );
      return;
    }

    this.lastCleanupTime = now;

    try {
      const dueRoles = await processScheduledRoles();

      if (dueRoles.length === 0) {
        this.logger.debug("No scheduled roles due for assignment");
        return;
      }

      this.logger.info(
        `Found ${dueRoles.length} scheduled role(s) due for assignment`,
      );

      // Process each scheduled role
      for (const scheduledRole of dueRoles) {
        await this.executeScheduledRole(scheduledRole);
      }
    } catch (error) {
      this.logger.error("Error processing scheduled roles:", error);
    }
  }

  /**
   * Execute a scheduled role assignment
   * @param {Object} scheduledRole
   */
  async executeScheduledRole(scheduledRole) {
    try {
      const {
        scheduleId,
        guildId,
        userIds,
        roleId,
        duration,
        reason,
        scheduledBy,
      } = scheduledRole;

      this.logger.info(
        `Executing scheduled role ${scheduleId} for ${userIds.length} users`,
      );

      // Calculate expiration time
      const durationMs = this.parseDuration(duration);
      if (!durationMs) {
        this.logger.error(
          `Invalid duration for scheduled role ${scheduleId}: ${duration}`,
        );
        await this.markScheduledRoleComplete(
          scheduleId,
          "failed",
          "Invalid duration",
        );
        return;
      }

      const expiresAt = new Date(Date.now() + durationMs);

      // Assign roles to all users
      const results = await Promise.allSettled(
        userIds.map(userId =>
          addTemporaryRole(guildId, userId, roleId, expiresAt),
        ),
      );

      // Process results
      const successful = results.filter(
        r => r.status === "fulfilled" && r.value,
      ).length;
      const failed = results.length - successful;

      this.logger.info(
        `Scheduled role ${scheduleId} completed: ${successful}/${userIds.length} successful`,
      );

      // Mark as completed
      await this.markScheduledRoleComplete(
        scheduleId,
        "completed",
        `Assigned to ${successful}/${userIds.length} users`,
      );

      // Send notification if configured
      await this.sendScheduledRoleNotification(
        guildId,
        roleId,
        successful,
        failed,
        reason,
        scheduledBy,
      );
    } catch (error) {
      this.logger.error(
        `Error executing scheduled role ${scheduledRole.scheduleId}:`,
        error,
      );
      await this.markScheduledRoleComplete(
        scheduledRole.scheduleId,
        "failed",
        error.message,
      );
    }
  }

  /**
   * Process recurring schedules that are due
   */
  async processRecurringSchedules() {
    try {
      const dueSchedules = await processRecurringSchedules();

      if (dueSchedules.length === 0) {
        this.logger.debug("No recurring schedules due for execution");
        return;
      }

      this.logger.info(
        `Found ${dueSchedules.length} recurring schedule(s) due for execution`,
      );

      // Process each recurring schedule
      for (const recurringSchedule of dueSchedules) {
        await this.executeRecurringSchedule(recurringSchedule);
      }
    } catch (error) {
      this.logger.error("Error processing recurring schedules:", error);
    }
  }

  /**
   * Execute a recurring schedule
   * @param {Object} recurringSchedule
   */
  async executeRecurringSchedule(recurringSchedule) {
    try {
      const {
        scheduleId,
        guildId,
        userIds,
        roleId,
        duration,
        reason,
        createdBy,
        schedule,
      } = recurringSchedule;

      this.logger.info(
        `Executing recurring schedule ${scheduleId} for ${userIds.length} users`,
      );

      // Calculate expiration time
      const durationMs = this.parseDuration(duration);
      if (!durationMs) {
        this.logger.error(
          `Invalid duration for recurring schedule ${scheduleId}: ${duration}`,
        );
        return;
      }

      const expiresAt = new Date(Date.now() + durationMs);

      // Assign roles to all users
      const results = await Promise.allSettled(
        userIds.map(userId =>
          addTemporaryRole(guildId, userId, roleId, expiresAt),
        ),
      );

      // Process results
      const successful = results.filter(
        r => r.status === "fulfilled" && r.value,
      ).length;
      const failed = results.length - successful;

      this.logger.info(
        `Recurring schedule ${scheduleId} completed: ${successful}/${userIds.length} successful`,
      );

      // Update next run time
      await this.updateRecurringScheduleNextRun(scheduleId, schedule);

      // Send notification if configured
      await this.sendRecurringScheduleNotification(
        guildId,
        roleId,
        successful,
        failed,
        reason,
        createdBy,
      );
    } catch (error) {
      this.logger.error(
        `Error executing recurring schedule ${recurringSchedule.scheduleId}:`,
        error,
      );
    }
  }

  /**
   * Mark a scheduled role as completed
   * @param {string} scheduleId
   * @param {string} status
   * @param {string} result
   */
  async markScheduledRoleComplete(scheduleId, status, result) {
    try {
      const storageManager = await getStorageManager();
      const scheduledRoles =
        (await storageManager.read("scheduled_roles")) || {};

      if (scheduledRoles[scheduleId]) {
        scheduledRoles[scheduleId].status = status;
        scheduledRoles[scheduleId].completedAt = new Date().toISOString();
        scheduledRoles[scheduleId].result = result;

        await storageManager.write("scheduled_roles", scheduledRoles);
      }
    } catch (error) {
      this.logger.error(
        `Error marking scheduled role ${scheduleId} as complete:`,
        error,
      );
    }
  }

  /**
   * Update the next run time for a recurring schedule
   * @param {string} scheduleId
   * @param {Object} schedule
   */
  async updateRecurringScheduleNextRun(scheduleId, schedule) {
    try {
      const storageManager = await getStorageManager();
      const recurringSchedules =
        (await storageManager.read("recurring_schedules")) || {};

      if (recurringSchedules[scheduleId]) {
        const nextRun = this.calculateNextRun(schedule);
        recurringSchedules[scheduleId].lastRun = new Date().toISOString();
        recurringSchedules[scheduleId].nextRun = nextRun.toISOString();

        await storageManager.write("recurring_schedules", recurringSchedules);
      }
    } catch (error) {
      this.logger.error(
        `Error updating recurring schedule ${scheduleId} next run:`,
        error,
      );
    }
  }

  /**
   * Send notification for scheduled role completion
   * @param {string} guildId
   * @param {string} roleId
   * @param {number} successful
   * @param {number} failed
   * @param {string} reason
   * @param {string} scheduledBy
   */
  async sendScheduledRoleNotification(
    guildId,
    roleId,
    successful,
    failed,
    reason,
    scheduledBy,
  ) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      // Try to find a log channel or general channel
      const logChannel =
        guild.channels.cache.find(
          ch =>
            ch.name.includes("log") ||
            ch.name.includes("admin") ||
            ch.name.includes("mod"),
        ) || guild.channels.cache.find(ch => ch.type === 0); // Text channel

      if (!logChannel) return;

      const role = guild.roles.cache.get(roleId);
      const roleName = role ? role.name : "Unknown Role";

      const embed = {
        title: "⏰ Scheduled Role Assignment Complete",
        description: `A scheduled temporary role assignment has been completed.`,
        color: 0x00ff00,
        fields: [
          {
            name: "✅ Successful",
            value: `${successful} user(s)`,
            inline: true,
          },
          {
            name: "❌ Failed",
            value: `${failed} user(s)`,
            inline: true,
          },
          {
            name: "🎯 Role",
            value: roleName,
            inline: true,
          },
          {
            name: "📝 Reason",
            value: reason || "No reason specified",
            inline: true,
          },
          {
            name: "👤 Scheduled By",
            value: `<@${scheduledBy}>`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error("Error sending scheduled role notification:", error);
    }
  }

  /**
   * Send notification for recurring schedule execution
   * @param {string} guildId
   * @param {string} roleId
   * @param {number} successful
   * @param {number} failed
   * @param {string} reason
   * @param {string} createdBy
   */
  async sendRecurringScheduleNotification(
    guildId,
    roleId,
    successful,
    failed,
    reason,
    createdBy,
  ) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      // Try to find a log channel or general channel
      const logChannel =
        guild.channels.cache.find(
          ch =>
            ch.name.includes("log") ||
            ch.name.includes("admin") ||
            ch.name.includes("mod"),
        ) || guild.channels.cache.find(ch => ch.type === 0); // Text channel

      if (!logChannel) return;

      const role = guild.roles.cache.get(roleId);
      const roleName = role ? role.name : "Unknown Role";

      const embed = {
        title: "🔄 Recurring Role Assignment Executed",
        description: `A recurring temporary role assignment has been executed.`,
        color: 0x0099ff,
        fields: [
          {
            name: "✅ Successful",
            value: `${successful} user(s)`,
            inline: true,
          },
          {
            name: "❌ Failed",
            value: `${failed} user(s)`,
            inline: true,
          },
          {
            name: "🎯 Role",
            value: roleName,
            inline: true,
          },
          {
            name: "📝 Reason",
            value: reason || "No reason specified",
            inline: true,
          },
          {
            name: "👤 Created By",
            value: `<@${createdBy}>`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error(
        "Error sending recurring schedule notification:",
        error,
      );
    }
  }

  /**
   * Calculate the next run time for a recurring schedule
   * @param {Object} schedule
   * @returns {Date}
   */
  calculateNextRun(schedule) {
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
   * Parse duration string to milliseconds
   * @param {string} duration
   * @returns {number|null}
   */
  parseDuration(duration) {
    try {
      const match = duration.match(/^(\d+)(m|h|d|w)$/);
      if (!match) return null;

      const amount = parseInt(match[1]);
      const unit = match[2];

      switch (unit) {
        case "m":
          return amount * 60 * 1000; // minutes
        case "h":
          return amount * 60 * 60 * 1000; // hours
        case "d":
          return amount * 24 * 60 * 60 * 1000; // days
        case "w":
          return amount * 7 * 24 * 60 * 60 * 1000; // weeks
        default:
          return null;
      }
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get scheduler status
   * @returns {Object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCleanupTime: this.lastCleanupTime,
      nextCleanupTime: this.lastCleanupTime + this.cleanupCooldown,
    };
  }
}
