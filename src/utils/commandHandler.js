import { Collection } from "discord.js";
import { getEventHandler } from "./eventHandler.js";

class CommandHandler {
  constructor() {
    this.commands = new Collection();
    this.permissionCache = new Collection();
    this.commandStats = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Register commands
  registerCommand(command) {
    if (command.data && command.execute) {
      this.commands.set(command.data.name, command);
      console.log(`✅ Registered command: ${command.data.name}`);
    }
  }

  // Get command
  getCommand(commandName) {
    return this.commands.get(commandName);
  }

  // Permission caching
  async checkPermissionWithCache(member, permission) {
    const cacheKey = `${member.id}:${permission}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.hasPermission;
    }

    const hasPermission = member.permissions.has(permission);
    this.permissionCache.set(cacheKey, {
      hasPermission,
      timestamp: Date.now(),
    });

    return hasPermission;
  }

  // Clear permission cache for a user
  clearUserPermissionCache(userId) {
    for (const [key] of this.permissionCache) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }

  // Command statistics
  recordCommand(commandName, userId, duration) {
    const stats = this.commandStats.get(commandName) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastUsed: 0,
      users: new Set(),
    };

    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.lastUsed = Date.now();
    stats.users.add(userId);

    this.commandStats.set(commandName, stats);
  }

  getCommandStats() {
    const stats = {};
    for (const [commandName, data] of this.commandStats) {
      stats[commandName] = {
        count: data.count,
        avgDuration: data.avgDuration,
        lastUsed: new Date(data.lastUsed).toISOString(),
        uniqueUsers: data.users.size,
      };
    }
    return stats;
  }

  // Optimized command execution
  async executeCommand(interaction, client) {
    const commandName = interaction.commandName;
    const command = this.getCommand(commandName);

    if (!command) {
      await this.handleUnknownCommand(interaction);
      return;
    }

    const startTime = Date.now();
    const eventHandler = getEventHandler();

    try {
      // Check if interaction is already handled
      if (interaction.replied || interaction.deferred) {
        console.log(
          `⚠️ Interaction already handled for command: ${commandName}`,
        );
        return;
      }

      // Process command with event handler
      await eventHandler.processEvent(
        `command:${commandName}`,
        async () => {
          await command.execute(interaction, client);
        },
        interaction,
        client,
      );

      const duration = Date.now() - startTime;
      this.recordCommand(commandName, interaction.user.id, duration);

      console.log(
        `✅ Command executed: ${commandName} by ${interaction.user.tag} (${duration}ms)`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Error executing command ${commandName}:`, error);

      await this.handleCommandError(interaction, error, duration);
    }
  }

  // Handle unknown commands
  async handleUnknownCommand(interaction) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Unknown command.",
          flags: 64,
        });
      }
    } catch (error) {
      console.error("Failed to handle unknown command:", error);
    }
  }

  // Handle command errors
  async handleCommandError(interaction, error, _duration) {
    try {
      let errorMessage = "❌ An error occurred while executing the command.";

      // Provide specific error messages for common issues
      if (error.code === 10062) {
        errorMessage = "❌ Command timed out. Please try again.";
      } else if (error.code === 40060) {
        errorMessage = "❌ Interaction already processed.";
      } else if (error.message.includes("permission")) {
        errorMessage = "❌ You don't have permission to use this command.";
      } else if (error.message.includes("rate limit")) {
        errorMessage =
          "❌ You're using commands too quickly. Please wait a moment.";
      }

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorMessage,
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: errorMessage,
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error response:", replyError);
    }
  }

  // Get all registered commands
  getAllCommands() {
    return Array.from(this.commands.keys());
  }

  // Get command info
  getCommandInfo(commandName) {
    const command = this.getCommand(commandName);
    if (!command) return null;

    return {
      name: command.data.name,
      description: command.data.description,
      defaultMemberPermissions: command.data.defaultMemberPermissions,
      options: command.data.options || [],
    };
  }

  // Cleanup old cache entries
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.permissionCache) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.permissionCache.delete(key);
      }
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      totalCommands: this.commands.size,
      permissionCacheSize: this.permissionCache.size,
      commandStats: this.getCommandStats(),
    };
  }
}

// Singleton instance
let commandHandler = null;

export function getCommandHandler() {
  if (!commandHandler) {
    commandHandler = new CommandHandler();

    // Cleanup old cache entries every 10 minutes
    setInterval(
      () => {
        commandHandler.cleanup();
      },
      10 * 60 * 1000,
    ).unref();
  }
  return commandHandler;
}

export { CommandHandler };
