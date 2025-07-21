/**
 * @fileoverview Command Handler for Role Reactor Bot
 *
 * Manages command registration, execution, caching, and statistics.
 * Provides centralized command processing with permission checking,
 * rate limiting, and performance monitoring.
 *
 * @author Tyecode
 * @version 0.1.0
 * @license MIT
 */

import { Collection } from "discord.js";
import { getEventHandler } from "./eventHandler.js";
import { getLogger } from "../logger.js";

/**
 * Command Handler Class
 *
 * Handles all aspects of command management including registration,
 * execution, permission caching, and statistics tracking.
 *
 * @class CommandHandler
 * @example
 * const handler = new CommandHandler();
 * handler.registerCommand(myCommand);
 * await handler.executeCommand(interaction, client);
 */
class CommandHandler {
  /**
   * Creates a new CommandHandler instance
   *
   * Initializes internal collections for commands, permission cache,
   * and command statistics. Sets up cache timeout for performance.
   *
   * @constructor
   */
  constructor() {
    this.logger = getLogger();
    this.commands = new Collection();
    this.permissionCache = new Collection();
    this.commandStats = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Registers a command with the handler
   *
   * Validates the command structure and adds it to the internal
   * commands collection for later execution.
   *
   * @param {Object} command - The command object to register
   * @param {Object} command.data - Command metadata (name, description, etc.)
   * @param {Function} command.execute - Command execution function
   * @returns {boolean} True if command was registered successfully
   * @example
   * const command = {
   *   data: { name: 'ping', description: 'Pong!' },
   *   execute: async (interaction) => { await interaction.reply('Pong!'); }
   * };
   * handler.registerCommand(command);
   */
  registerCommand(command) {
    if (command.data && command.execute) {
      this.commands.set(command.data.name, command);
      this.logger.info(`✅ Registered command: ${command.data.name}`);
      return true;
    }
    return false;
  }

  /**
   * Retrieves a command by name
   *
   * @param {string} commandName - Name of the command to retrieve
   * @returns {Object|null} The command object or null if not found
   * @example
   * const command = handler.getCommand('ping');
   * if (command) { /* command exists *\/ }
   */
  getCommand(commandName) {
    return this.commands.get(commandName);
  }

  /**
   * Checks user permissions with caching for performance
   *
   * Caches permission checks for 5 minutes to reduce API calls
   * and improve response times for repeated permission checks.
   *
   * @param {GuildMember} member - Discord guild member to check
   * @param {string} permission - Permission to check (e.g., 'ManageRoles')
   * @returns {Promise<boolean>} True if member has permission
   * @example
   * const hasPermission = await handler.checkPermissionWithCache(member, 'ManageRoles');
   * if (hasPermission) { /* user can manage roles *\/ }
   */
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

  /**
   * Clears permission cache for a specific user
   *
   * Useful when user permissions change (role updates, etc.)
   * to ensure fresh permission checks.
   *
   * @param {string} userId - Discord user ID to clear cache for
   * @example
   * handler.clearUserPermissionCache('123456789012345678');
   * // Next permission check for this user will be fresh
   */
  clearUserPermissionCache(userId) {
    for (const [key] of this.permissionCache) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }

  /**
   * Records command execution statistics
   *
   * Tracks usage count, duration, average response time, and
   * unique users for each command for analytics and monitoring.
   *
   * @param {string} commandName - Name of the executed command
   * @param {string} userId - ID of the user who executed the command
   * @param {number} duration - Execution time in milliseconds
   * @example
   * handler.recordCommand('ping', '123456789012345678', 150);
   * // Updates statistics for ping command
   */
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

  /**
   * Retrieves command usage statistics
   *
   * Returns comprehensive statistics for all commands including
   * usage count, average duration, last used time, and unique users.
   *
   * @returns {Object} Statistics for all commands
   * @example
   * const stats = handler.getCommandStats();
   * console.log(stats.ping.count); // Usage count for ping command
   * console.log(stats.ping.avgDuration); // Average response time
   */
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

  /**
   * Executes a command with comprehensive error handling
   *
   * Main command execution method that handles interaction validation,
   * command lookup, execution, error handling, and statistics tracking.
   *
   * @param {CommandInteraction} interaction - Discord interaction object
   * @param {Client} client - Discord.js client instance
   * @returns {Promise<void>}
   * @example
   * await handler.executeCommand(interaction, client);
   * // Command is executed with full error handling and logging
   */
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
        this.logger.warn(
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

      this.logger.logCommand(commandName, interaction.user.id, duration, true);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Error executing command ${commandName}`, error);

      await this.handleCommandError(interaction, error, duration);
    }
  }

  /**
   * Handles unknown or invalid commands
   *
   * Sends a user-friendly error message when a command is not found
   * or is invalid. Ensures the interaction is properly responded to.
   *
   * @param {CommandInteraction} interaction - Discord interaction object
   * @returns {Promise<void>}
   * @example
   * await handler.handleUnknownCommand(interaction);
   * // User receives "Unknown command" message
   */
  async handleUnknownCommand(interaction) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Unknown command.",
          flags: 64,
        });
      }
    } catch (error) {
      this.logger.error("Failed to handle unknown command", error);
    }
  }

  /**
   * Handles command execution errors
   *
   * Provides user-friendly error messages for common Discord API errors
   * and logs detailed error information for debugging.
   *
   * @param {CommandInteraction} interaction - Discord interaction object
   * @param {Error} error - The error that occurred
   * @param {number} duration - Command execution duration
   * @returns {Promise<void>}
   * @example
   * await handler.handleCommandError(interaction, error, 150);
   * // User receives appropriate error message based on error type
   */
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
      this.logger.error("Failed to send error response", replyError);
    }
  }

  /**
   * Gets all registered command names
   *
   * @returns {Array<string>} Array of registered command names
   * @example
   * const commands = handler.getAllCommands();
   * // ['ping', 'setup-roles', 'help', ...]
   */
  getAllCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Gets detailed information about a specific command
   *
   * @param {string} commandName - Name of the command
   * @returns {Object|null} Command information or null if not found
   * @example
   * const info = handler.getCommandInfo('ping');
   * // { name: 'ping', description: 'Pong!', options: [], ... }
   */
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

  /**
   * Cleans up old cache entries
   *
   * Removes expired permission cache entries to prevent memory leaks.
   * Should be called periodically or when memory usage is high.
   *
   * @example
   * handler.cleanup();
   * // Removes cache entries older than 5 minutes
   */
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
