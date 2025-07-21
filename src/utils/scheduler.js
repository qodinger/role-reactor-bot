import { getStorageManager } from "./storage/storageManager.js";
import { getLogger } from "./logger.js";

// Get expired temporary roles from storage
const getExpiredTemporaryRoles = async () => {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    const expiredRoles = [];

    for (const [guildId, guildRoles] of Object.entries(tempRoles)) {
      for (const [userId, userRoles] of Object.entries(guildRoles)) {
        for (const [roleId, roleData] of Object.entries(userRoles)) {
          if (new Date(roleData.expiresAt) <= new Date()) {
            expiredRoles.push({
              guildId,
              userId,
              roleId,
              expiresAt: roleData.expiresAt,
            });
          }
        }
      }
    }

    return expiredRoles;
  } catch (error) {
    logger.error("❌ Failed to get expired temporary roles", error);
    return [];
  }
};

// Task management for testing
const tasks = new Map();
let taskIdCounter = 0;

// Schedule a task
const scheduleTask = (task, delay) => {
  if (!task || typeof task !== "function") {
    throw new Error("Task must be a function");
  }

  if (typeof delay !== "number" || delay < 0) {
    throw new Error("Delay must be a non-negative number");
  }

  const taskId = `task_${++taskIdCounter}`;
  const timeoutId = setTimeout(() => {
    try {
      task();
    } catch (error) {
      const logger = getLogger();
      logger.error("Task execution error", error);
    } finally {
      tasks.delete(taskId);
    }
  }, delay).unref();

  tasks.set(taskId, {
    task,
    timeoutId,
    type: "single",
    delay,
    createdAt: Date.now(),
  });

  return taskId;
};

// Cancel a task
const cancelTask = taskId => {
  const taskInfo = tasks.get(taskId);
  if (taskInfo) {
    clearTimeout(taskInfo.timeoutId);
    tasks.delete(taskId);
    return true;
  }
  return false;
};

// Schedule a recurring task
const scheduleRecurringTask = (task, interval) => {
  const taskId = `recurring_${++taskIdCounter}`;

  const executeTask = () => {
    try {
      task();
    } catch (error) {
      const logger = getLogger();
      logger.error("Recurring task execution error", error);
    }
  };

  const intervalId = setInterval(executeTask, interval).unref();

  tasks.set(taskId, {
    task: executeTask,
    timeoutId: intervalId,
    type: "recurring",
    interval,
    createdAt: Date.now(),
  });

  return taskId;
};

// Get active tasks
const getActiveTasks = () => {
  return Array.from(tasks.keys());
};

// Get task info
const getTaskInfo = taskId => {
  const taskInfo = tasks.get(taskId);
  if (taskInfo) {
    return {
      id: taskId,
      type: taskInfo.type,
      delay: taskInfo.delay,
      interval: taskInfo.interval,
      createdAt: taskInfo.createdAt,
    };
  }
  return null;
};

// Clear all tasks
const clearAllTasks = () => {
  for (const [, taskInfo] of tasks) {
    if (taskInfo.type === "recurring") {
      clearInterval(taskInfo.timeoutId);
    } else {
      clearTimeout(taskInfo.timeoutId);
    }
  }
  tasks.clear();
};

class RoleExpirationScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Role expiration scheduler is already running");
      return;
    }

    this.logger.info("🕐 Starting role expiration scheduler...");
    this.isRunning = true;

    // Run cleanup every minute
    this.interval = setInterval(async () => {
      try {
        await this.cleanupExpiredRoles();
      } catch (error) {
        this.logger.error("❌ Error in role expiration scheduler", error);
      }
    }, 60000).unref(); // Check every minute

    // Run initial cleanup
    this.cleanupExpiredRoles();
  }

  // Stop the scheduler
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.logger.info("🛑 Role expiration scheduler stopped");
  }

  // Clean up expired roles
  async cleanupExpiredRoles() {
    try {
      const expiredRoles = await getExpiredTemporaryRoles();

      if (expiredRoles.length === 0) {
        return;
      }

      this.logger.info(
        `⏰ Found ${expiredRoles.length} expired temporary role(s) to clean up`,
      );

      let removedCount = 0;
      let errorCount = 0;

      for (const expiredRole of expiredRoles) {
        try {
          // Get the guild
          const guild = this.client.guilds.cache.get(expiredRole.guildId);
          if (!guild) {
            this.logger.warn(
              `⚠️ Guild ${expiredRole.guildId} not found, skipping role cleanup`,
            );
            continue;
          }

          // Get the member
          const member = await guild.members.fetch(expiredRole.userId);
          if (!member) {
            this.logger.warn(
              `⚠️ Member ${expiredRole.userId} not found in guild ${guild.name}, skipping role cleanup`,
            );
            continue;
          }

          // Get the role
          const role = guild.roles.cache.get(expiredRole.roleId);
          if (!role) {
            this.logger.warn(
              `⚠️ Role ${expiredRole.roleId} not found in guild ${guild.name}, skipping role cleanup`,
            );
            continue;
          }

          // Check if member still has the role
          if (!member.roles.cache.has(role.id)) {
            this.logger.info(
              `ℹ️ Member ${member.user.tag} no longer has role ${role.name}, skipping removal`,
            );
            continue;
          }

          // Remove the role
          await member.roles.remove(role, "Temporary role expired");
          removedCount++;

          this.logger.success(
            `✅ Removed expired role "${role.name}" from ${member.user.tag} in ${guild.name}`,
          );

          // Remove the expired role record from storage
          try {
            const storageManager = await getStorageManager();
            await storageManager.removeTemporaryRole(
              expiredRole.guildId,
              expiredRole.userId,
              expiredRole.roleId,
            );
            this.logger.info(
              `🗑️ Removed expired role record for user ${expiredRole.userId} in guild ${expiredRole.guildId}`,
            );
          } catch (dbError) {
            this.logger.error(
              `❌ Failed to remove expired role record for user ${expiredRole.userId}`,
              dbError,
            );
          }

          // Send notification to user
          try {
            const { EmbedBuilder } = await import("discord.js");
            const embed = new EmbedBuilder()
              .setTitle("⏰ Temporary Role Expired!")
              .setDescription(
                `Your temporary **${role.name}** role in **${guild.name}** has expired and been automatically removed.`,
              )
              .setColor(0xff0000)
              .setTimestamp()
              .setFooter({
                text: "Role Reactor • Temporary Roles",
                iconURL: this.client.user.displayAvatarURL(),
              });

            embed.addFields(
              {
                name: "🎭 Role",
                value: `${role.name}`,
                inline: true,
              },
              {
                name: "🏠 Server",
                value: `${guild.name}`,
                inline: true,
              },
            );

            await member.user.send({ embeds: [embed] });
          } catch (error) {
            // User might have DMs disabled, that's okay
            this.logger.warn(
              `Could not send expiration notification to ${member.user.tag}`,
              { error: error.message },
            );
          }
        } catch (error) {
          errorCount++;
          this.logger.error(
            `❌ Error removing expired role for user ${expiredRole.userId}`,
            error,
          );
        }
      }

      this.logger.success(
        `✅ Cleanup complete: ${removedCount} roles removed, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error("❌ Error in cleanup process", error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval ? "active" : "inactive",
    };
  }
}

export default RoleExpirationScheduler;

// Export utility functions for testing
export {
  scheduleTask,
  cancelTask,
  scheduleRecurringTask,
  getActiveTasks,
  getTaskInfo,
  clearAllTasks,
};

let scheduler = null;

export function getScheduler() {
  if (!scheduler) {
    scheduler = new RoleExpirationScheduler();
  }
  return scheduler;
}
