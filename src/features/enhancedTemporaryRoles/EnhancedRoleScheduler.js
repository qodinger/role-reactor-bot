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
        await this.processExpiredTemporaryRoles();

        // Clean up old schedules every 30 minutes to keep database clean
        const now = Date.now();
        if (!this.lastCleanupTime || now - this.lastCleanupTime >= 1800000) {
          await this.cleanupOldSchedules();
          this.lastCleanupTime = now;
        }
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

    // Immediately clean up old data on startup
    this.cleanupOldSchedules();
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
   * Process expired temporary roles and clean them up
   */
  async processExpiredTemporaryRoles() {
    try {
      // First, check for expired scheduled roles and mark them as expired
      await this.processExpiredScheduledRoles();

      // Then clean up expired temporary roles
      const storageManager = await getStorageManager();
      const temporaryRoles = await storageManager.getTemporaryRoles();
      const now = new Date();
      let expiredCount = 0;

      for (const [guildId, guildRoles] of Object.entries(temporaryRoles)) {
        for (const [userId, userRoles] of Object.entries(guildRoles)) {
          for (const [roleId, roleData] of Object.entries(userRoles)) {
            const expiresAt = new Date(roleData.expiresAt);

            if (expiresAt <= now) {
              this.logger.info(
                `🕐 Removing expired temporary role ${roleId} from user ${userId} in guild ${guildId}`,
              );

              try {
                // Remove the Discord role
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) {
                  const member = await guild.members.fetch(userId);
                  const role = guild.roles.cache.get(roleId);

                  if (member && role && member.roles.cache.has(roleId)) {
                    await member.roles.remove(role, "Temporary role expired");
                    this.logger.info(
                      `✅ Removed expired role ${role.name} from user ${userId}`,
                    );
                  }
                }

                // Remove from storage
                await storageManager.removeTemporaryRole(
                  guildId,
                  userId,
                  roleId,
                );
                expiredCount++;
              } catch (error) {
                this.logger.error(
                  `❌ Failed to remove expired role ${roleId} from user ${userId}:`,
                  error.message,
                );
              }
            }
          }
        }
      }

      if (expiredCount > 0) {
        this.logger.info(
          `🧹 Cleaned up ${expiredCount} expired temporary roles`,
        );
      }
    } catch (error) {
      this.logger.error("Error processing expired temporary roles:", error);
    }
  }

  /**
   * Process expired scheduled roles and mark them as expired
   */
  async processExpiredScheduledRoles() {
    try {
      const storageManager = await getStorageManager();
      const scheduledRoles =
        (await storageManager.read("scheduled_roles")) || {};
      const now = new Date();
      let expiredCount = 0;

      for (const [scheduleId, roleData] of Object.entries(scheduledRoles)) {
        // Only process active roles (roles that have been assigned and are running)
        if (roleData.status === "active" && roleData.actualExpiresAt) {
          const expiresAt = new Date(roleData.actualExpiresAt);

          if (expiresAt <= now) {
            this.logger.info(
              `🕐 Marking scheduled role ${scheduleId} as expired`,
            );

            // Mark as expired
            await this.markScheduledRoleComplete(
              scheduleId,
              "expired",
              "Role duration expired",
            );

            expiredCount++;
          }
        }
      }

      if (expiredCount > 0) {
        this.logger.info(
          `📝 Marked ${expiredCount} scheduled roles as expired`,
        );
      }
    } catch (error) {
      this.logger.error("Error processing expired scheduled roles:", error);
    }
  }

  /**
   * Clean up old completed, cancelled, and expired schedules to keep the database clean
   */
  async cleanupOldSchedules() {
    try {
      const storageManager = await getStorageManager();
      const scheduledRoles =
        (await storageManager.read("scheduled_roles")) || {};
      const recurringSchedules =
        (await storageManager.read("recurring_schedules")) || {};
      const now = new Date();
      let scheduledCleanedCount = 0;
      let recurringCleanedCount = 0;

      // Clean up scheduled roles
      for (const [scheduleId, roleData] of Object.entries(scheduledRoles)) {
        let shouldCleanup = false;
        let cleanupReason = "";

        // Clean up completed schedules after 1 hour
        if (roleData.status === "completed" && roleData.completedAt) {
          const completedAt = new Date(roleData.completedAt);
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (completedAt <= oneHourAgo) {
            shouldCleanup = true;
            cleanupReason = "completed (older than 1 hour)";
          }
        }

        // Clean up cancelled schedules after 30 minutes
        if (roleData.status === "cancelled" && roleData.createdAt) {
          const createdAt = new Date(roleData.createdAt);
          const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
          if (createdAt <= thirtyMinutesAgo) {
            shouldCleanup = true;
            cleanupReason = "cancelled (older than 30 minutes)";
          }
        }

        // Clean up expired schedules after 1 hour
        if (roleData.status === "expired" && roleData.expiredAt) {
          const expiredAt = new Date(roleData.expiredAt);
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (expiredAt <= oneHourAgo) {
            shouldCleanup = true;
            cleanupReason = "expired (older than 1 hour)";
          }
        }

        // Clean up failed schedules after 2 hours
        if (roleData.status === "failed" && roleData.completedAt) {
          const failedAt = new Date(roleData.completedAt);
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          if (failedAt <= twoHoursAgo) {
            shouldCleanup = true;
            cleanupReason = "failed (older than 2 hours)";
          }
        }

        if (shouldCleanup) {
          this.logger.info(
            `🧹 Cleaning up ${cleanupReason} scheduled role ${scheduleId}`,
          );

          // Remove the old schedule
          delete scheduledRoles[scheduleId];
          scheduledCleanedCount++;
        }
      }

      // Clean up recurring schedules
      for (const [scheduleId, scheduleData] of Object.entries(
        recurringSchedules,
      )) {
        // Clean up cancelled recurring schedules after 30 minutes
        if (scheduleData.status === "cancelled" && scheduleData.createdAt) {
          const createdAt = new Date(scheduleData.createdAt);
          const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

          if (createdAt <= thirtyMinutesAgo) {
            this.logger.info(
              `🧹 Cleaning up cancelled recurring schedule ${scheduleId}`,
            );

            // Remove the old recurring schedule
            delete recurringSchedules[scheduleId];
            recurringCleanedCount++;
          }
        }
      }

      // Save changes if any cleanup was performed
      if (scheduledCleanedCount > 0) {
        await storageManager.write("scheduled_roles", scheduledRoles);
        this.logger.info(
          `🧹 Cleaned up ${scheduledCleanedCount} old scheduled roles`,
        );
      }

      if (recurringCleanedCount > 0) {
        await storageManager.write("recurring_schedules", recurringSchedules);
        this.logger.info(
          `🧹 Cleaned up ${recurringCleanedCount} old recurring schedules`,
        );
      }

      if (scheduledCleanedCount > 0 || recurringCleanedCount > 0) {
        this.logger.info(
          `🧹 Total cleanup: ${scheduledCleanedCount + recurringCleanedCount} schedules removed`,
        );
      }
    } catch (error) {
      this.logger.error("Error cleaning up old schedules:", error);
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
      this.logger.info(
        `🔄 Assigning role ${roleId} to ${userIds.length} users...`,
      );

      const results = await Promise.allSettled(
        userIds.map(async userId => {
          try {
            const result = await addTemporaryRole(
              guildId,
              userId,
              roleId,
              expiresAt,
              this.client,
            );
            this.logger.info(
              `✅ Role assigned to user ${userId}: ${result ? "Success" : "Failed"}`,
            );
            return result;
          } catch (error) {
            this.logger.error(
              `❌ Failed to assign role to user ${userId}:`,
              error.message,
            );
            return false;
          }
        }),
      );

      // Process results
      const successful = results.filter(
        r => r.status === "fulfilled" && r.value,
      ).length;
      const failed = results.length - successful;

      this.logger.info(
        `🎯 Scheduled role ${scheduleId} completed: ${successful}/${userIds.length} successful`,
      );

      // Mark as active (role is now assigned and running)
      await this.markScheduledRoleComplete(
        scheduleId,
        "active",
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
          addTemporaryRole(guildId, userId, roleId, expiresAt, this.client),
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
   * Mark a scheduled role with a new status
   * @param {string} scheduleId
   * @param {string} status - "pending", "active", "completed", "failed", "expired"
   * @param {string} result
   */
  async markScheduledRoleComplete(scheduleId, status, result) {
    try {
      const storageManager = await getStorageManager();
      const scheduledRoles =
        (await storageManager.read("scheduled_roles")) || {};

      if (scheduledRoles[scheduleId]) {
        scheduledRoles[scheduleId].status = status;

        if (status === "active") {
          // When role becomes active, set the actual expiration time
          const roleData = scheduledRoles[scheduleId];
          const durationMs = this.parseDuration(roleData.duration);
          if (durationMs) {
            scheduledRoles[scheduleId].actualExpiresAt = new Date(
              Date.now() + durationMs,
            ).toISOString();
          }
        }

        if (status === "completed" || status === "failed") {
          scheduledRoles[scheduleId].completedAt = new Date().toISOString();
        }

        if (status === "expired") {
          scheduledRoles[scheduleId].expiredAt = new Date().toISOString();
        }

        scheduledRoles[scheduleId].result = result;

        await storageManager.write("scheduled_roles", scheduledRoles);
        this.logger.info(
          `📝 Updated scheduled role ${scheduleId} status to: ${status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marking scheduled role ${scheduleId} as ${status}:`,
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

      // Try to find a log channel or general channel with proper permissions
      let logChannel = null;

      // First try to find a channel where the bot has permission to send messages
      const channels = guild.channels.cache.filter(
        ch =>
          ch.type === 0 && // Text channel
          ch.permissionsFor(guild.members.me).has("SendMessages"),
      );

      // Priority order: log > admin > mod > general > first available
      logChannel =
        channels.find(ch => ch.name.includes("log")) ||
        channels.find(ch => ch.name.includes("admin")) ||
        channels.find(ch => ch.name.includes("mod")) ||
        channels.find(ch => ch.name.includes("general")) ||
        channels.first();

      if (!logChannel) {
        this.logger.warn(
          `No suitable notification channel found in guild ${guildId}`,
        );
        return;
      }

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
      this.logger.info(
        `✅ Scheduled role notification sent to #${logChannel.name}`,
      );
    } catch (error) {
      this.logger.error("Error sending scheduled role notification:", error);
      // Don't let notification errors affect the main functionality
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

      // Try to find a log channel or general channel with proper permissions
      let logChannel = null;

      // First try to find a channel where the bot has permission to send messages
      const channels = guild.channels.cache.filter(
        ch =>
          ch.type === 0 && // Text channel
          ch.permissionsFor(guild.members.me).has("SendMessages"),
      );

      // Priority order: log > admin > mod > general > first available
      logChannel =
        channels.find(ch => ch.name.includes("log")) ||
        channels.find(ch => ch.name.includes("admin")) ||
        channels.find(ch => ch.name.includes("mod")) ||
        channels.find(ch => ch.name.includes("general")) ||
        channels.first();

      if (!logChannel) {
        this.logger.warn(
          `No suitable notification channel found in guild ${guildId}`,
        );
        return;
      }

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
