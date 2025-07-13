// Mock functions for temporary roles (these would be implemented in a real app)
const cleanupExpiredRoles = async () => {
  // Mock implementation for tests
  console.log("Mock: Cleaning up expired roles");
};

const getExpiredTemporaryRoles = async () => {
  // Mock implementation for tests
  return [];
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
      console.error("Task execution error:", error);
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
      console.error("Recurring task execution error:", error);
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
    this.interval = null;
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log("⚠️ Role expiration scheduler is already running");
      return;
    }

    console.log("🕐 Starting role expiration scheduler...");
    this.isRunning = true;

    // Run cleanup every minute
    this.interval = setInterval(async () => {
      try {
        await this.cleanupExpiredRoles();
      } catch (error) {
        console.error("❌ Error in role expiration scheduler:", error);
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
    console.log("🛑 Role expiration scheduler stopped");
  }

  // Clean up expired roles
  async cleanupExpiredRoles() {
    try {
      const expiredRoles = await getExpiredTemporaryRoles();

      if (expiredRoles.length === 0) {
        return;
      }

      console.log(
        `⏰ Found ${expiredRoles.length} expired temporary role(s) to clean up`,
      );

      let removedCount = 0;
      let errorCount = 0;

      for (const expiredRole of expiredRoles) {
        try {
          // Get the guild
          const guild = this.client.guilds.cache.get(expiredRole.guildId);
          if (!guild) {
            console.log(
              `⚠️ Guild ${expiredRole.guildId} not found, skipping role cleanup`,
            );
            continue;
          }

          // Get the member
          const member = await guild.members.fetch(expiredRole.userId);
          if (!member) {
            console.log(
              `⚠️ Member ${expiredRole.userId} not found in guild ${guild.name}, skipping role cleanup`,
            );
            continue;
          }

          // Get the role
          const role = guild.roles.cache.get(expiredRole.roleId);
          if (!role) {
            console.log(
              `⚠️ Role ${expiredRole.roleId} not found in guild ${guild.name}, skipping role cleanup`,
            );
            continue;
          }

          // Check if member still has the role
          if (!member.roles.cache.has(role.id)) {
            console.log(
              `ℹ️ Member ${member.user.tag} no longer has role ${role.name}, skipping removal`,
            );
            continue;
          }

          // Remove the role
          await member.roles.remove(role, "Temporary role expired");
          removedCount++;

          console.log(
            `✅ Removed expired role "${role.name}" from ${member.user.tag} in ${guild.name}`,
          );

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
                text: "RoleReactor • Temporary Roles",
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
            console.log(
              `Could not send expiration notification to ${member.user.tag}: ${error.message}`,
            );
          }
        } catch (error) {
          errorCount++;
          console.error(
            `❌ Error removing expired role for user ${expiredRole.userId} in guild ${expiredRole.guildId}:`,
            error,
          );
        }
      }

      // Clean up the expired roles from tracking
      if (removedCount > 0 || errorCount > 0) {
        await cleanupExpiredRoles();
      }

      if (removedCount > 0) {
        console.log(
          `✅ Successfully removed ${removedCount} expired temporary role(s)`,
        );
      }

      if (errorCount > 0) {
        console.log(
          `❌ Failed to remove ${errorCount} expired temporary role(s)`,
        );
      }
    } catch (error) {
      console.error("❌ Error in cleanupExpiredRoles:", error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval ? "1 minute" : null,
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
