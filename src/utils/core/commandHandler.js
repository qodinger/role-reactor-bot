import { Collection, MessageFlags } from "discord.js";
import { getEventHandler } from "./eventHandler.js";
import { getLogger } from "../logger.js";
import { getExperienceManager } from "../../features/experience/ExperienceManager.js";
import { getCommandRateLimiter } from "../rateLimit/commandRateLimiter.js";

/**
 * @typedef {import('discord.js').Client & { commands?: Collection<string, any> }} ExtendedClient
 * @typedef {import('discord.js').CommandInteraction<any> & { _handled?: boolean }} ExtendedInteraction
 */

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
   * @param {ExtendedClient} client - Discord.js client instance (optional)
   */
  constructor(client = null) {
    this.logger = getLogger();
    this.commands = new Collection();
    this.permissionCache = new Collection();
    this.commandStats = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.client = client;
  }

  /**
   * Sets the Discord client reference
   *
   * @param {ExtendedClient} client - Discord.js client instance
   */
  setClient(client) {
    this.client = client;
    this.logger.debug("✅ Client reference set in command handler");
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
    // First try to get from command handler collection
    let command = this.commands.get(commandName);

    // If not found, try to get from client commands as fallback (if available)
    if (!command && this.client && this.client.commands) {
      command = this.client.commands.get(commandName);
      if (command) {
        this.logger.debug(
          `Found command '${commandName}' in client collection, registering in command handler`,
        );
        // Register it in the command handler for future use
        this.registerCommand(command);
      } else {
        // Only log warning if command is truly not found in either collection
        this.logger.warn(
          `⚠️ Command '${commandName}' not found in command handler or client collections`,
        );
      }
    }

    return command;
  }

  /**
   * Checks user permissions with caching for performance
   *
   * Caches permission checks for 5 minutes to reduce API calls
   * and improve response times for repeated permission checks.
   *
   * @param {import('discord.js').GuildMember} member - Discord guild member to check
   * @param {import('discord.js').PermissionResolvable} permission - Permission to check (e.g., 'ManageRoles')
   * @returns {Promise<boolean>} True if member has permission
   * @example
   * const hasPermission = await handler.checkPermissionWithCache(member, 'ManageRoles');
   * if (hasPermission) { /* user can manage roles *\/ }
   */
  async checkPermissionWithCache(member, permission) {
    if (!member) return false;

    const cacheKey = `${member.id}:${permission}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.hasPermission;
    }

    // Check if permissions property exists and has the has method
    if (!member.permissions || typeof member.permissions.has !== "function") {
      return false;
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
   * @param {string} [guildId] - ID of the guild where the command was executed
   * @example
   * handler.recordCommand('ping', '123456789012345678', 150, '123456789');
   * // Updates statistics for ping command
   */
  recordCommand(commandName, userId, duration, guildId = null) {
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

    // Persist to database asynchronously
    setTimeout(async () => {
      try {
        const { getDatabaseManager } = await import(
          "../storage/databaseManager.js"
        );
        const dbManager = await getDatabaseManager();
        if (dbManager && dbManager.commandUsage) {
          await dbManager.commandUsage.recordUsage(
            commandName,
            userId,
            guildId,
            duration,
          );
        }
      } catch (error) {
        this.logger.error("Failed to persist command usage:", error);
      }
    });
  }

  /**
   * Retrieves command usage statistics
   *
   * Returns comprehensive statistics for all commands including
   * usage count, average duration, last used time, and unique users.
   *
   * @param {boolean} [includePersistent=true] - Whether to include persistent stats from database
   * @returns {Promise<Object>} Statistics for all commands
   * @example
   * const stats = await handler.getCommandStats();
   * console.log(stats.ping.count); // Usage count for ping command
   * console.log(stats.ping.avgDuration); // Average response time
   */
  async getCommandStats(includePersistent = true) {
    const stats = {};

    // Get in-memory stats
    for (const [commandName, data] of this.commandStats) {
      stats[commandName] = {
        count: data.count,
        avgDuration: data.avgDuration,
        lastUsed: new Date(data.lastUsed).toISOString(),
        uniqueUsers: data.users.size,
        source: "memory",
      };
    }

    // Merge with persistent stats if requested
    if (includePersistent) {
      try {
        const { getDatabaseManager } = await import(
          "../storage/databaseManager.js"
        );
        const dbManager = await getDatabaseManager();
        if (dbManager && dbManager.commandUsage) {
          const dbStats = await dbManager.commandUsage.getAllStats();
          for (const s of dbStats) {
            if (stats[s.name]) {
              // Combine if we have both (memory might be more recent but DB has history)
              // For simplicity, we just show DB stats if available as they are comprehensive
              stats[s.name] = {
                count: s.count,
                avgDuration: s.avgDuration,
                lastUsed: s.lastUsed
                  ? new Date(s.lastUsed).toISOString()
                  : null,
                uniqueUsers: s.uniqueUsers,
                source: "database",
              };
            } else {
              stats[s.name] = {
                count: s.count,
                avgDuration: s.avgDuration,
                lastUsed: s.lastUsed
                  ? new Date(s.lastUsed).toISOString()
                  : null,
                uniqueUsers: s.uniqueUsers,
                source: "database",
              };
            }
          }
        }
      } catch (error) {
        this.logger.error("Failed to get persistent command stats:", error);
      }
    }

    return stats;
  }

  /**
   * Executes a command with comprehensive error handling
   *
   * Main command execution method that handles interaction validation,
   * command lookup, execution, error handling, and statistics tracking.
   *
   * @param {ExtendedInteraction} interaction - Discord interaction object
   * @param {ExtendedClient} client - Discord.js client instance
   * @returns {Promise<void>}
   * @example
   * await handler.executeCommand(interaction, client);
   * // Command is executed with full error handling and logging
   */
  async executeCommand(interaction, client) {
    const commandName = interaction.commandName;
    const command = this.getCommand(commandName);
    const rateLimiter = getCommandRateLimiter();

    if (!command) {
      await this.handleUnknownCommand(interaction);
      return;
    }

    // Check rate limits (skip for developers)
    const { config } = await import("../../config/config.js");
    const isDeveloper = config.isDeveloper(interaction.user.id);

    if (!isDeveloper) {
      const rateLimitResult = await rateLimiter.checkLimit(
        interaction.user.id,
        commandName,
        interaction.guildId || "dm",
      );

      if (!rateLimitResult.allowed) {
        const retryAfterSeconds = Math.ceil(
          (rateLimitResult.retryAfter || 1000) / 1000,
        );

        const rateLimitMessages = {
          spam_ban: `⛔ **Rate Limit Exceeded**\n\nYou've been temporarily blocked from using commands due to spam. Please wait **${retryAfterSeconds}s** before trying again.`,
          global_limit: `⏳ **Slow Down!**\n\nYou're using commands too quickly. Please wait **${retryAfterSeconds}s** before trying again.`,
          command_cooldown: `⏱️ **Command Cooldown**\n\nThis command is on cooldown. Please wait **${retryAfterSeconds}s** before using it again.`,
          guild_cooldown: `🐌 **Guild Cooldown**\n\nThis command is being used frequently in this server. Please wait **${retryAfterSeconds}s**.`,
        };

        await interaction.reply({
          content:
            rateLimitMessages[rateLimitResult.reason] ||
            `⏱️ **Rate Limit**\n\nPlease wait **${retryAfterSeconds}s** before using this command again.`,
          flags: [MessageFlags.Ephemeral],
        });

        this.logger.debug(
          `🚫 Rate limit: ${interaction.user.tag} (${interaction.user.id}) - ${commandName} - ${rateLimitResult.reason}`,
        );
        return;
      }

      // Record command usage
      await rateLimiter.recordUsage(
        interaction.user.id,
        commandName,
        interaction.guildId || "dm",
      );
    }

    // Check if command is disabled in this guild
    try {
      if (interaction.guildId) {
        const { getDatabaseManager } = await import(
          "../storage/databaseManager.js"
        );
        const dbManager = await getDatabaseManager();
        if (dbManager && dbManager.guildSettings) {
          const settings = await dbManager.guildSettings.getByGuild(
            interaction.guildId,
          );
          if (settings?.disabledCommands?.includes(commandName)) {
            await interaction.reply({
              content: `❌ The \`/${commandName}\` command has been disabled by an administrator in this server.`,
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to check disabled commands:", error);
      // Continue execution if check fails to avoid blocking commands due to DB issues
    }

    const startTime = Date.now();
    const eventHandler = getEventHandler();

    try {
      // Check if interaction is already handled
      if (interaction.replied || interaction.deferred || interaction._handled) {
        this.logger.warn(
          `⚠️ Interaction already handled for command: ${commandName}`,
        );
        return;
      }

      // Add timing debug for poll commands
      if (commandName === "poll") {
        const preXpStart = Date.now();
        this.logger.debug(
          `[CommandHandler] Starting poll command execution at ${preXpStart - startTime}ms`,
        );
      }

      // Optionally pre-award XP for commands that need fresh XP shown (e.g., /level)
      // Pre-award XP if requested by the command so the UI shows fresh totals
      // Make this asynchronous to avoid blocking command execution
      if (command.preAwardXP) {
        setTimeout(async () => {
          try {
            const experienceManager = await getExperienceManager();
            await experienceManager.awardCommandXP(
              interaction.guild.id,
              interaction.user.id,
              commandName,
              client,
            );
            this.logger.info(
              `✅ Pre-awarded command XP for ${interaction.user.tag} running ${commandName}`,
            );
          } catch (preXpError) {
            this.logger.error(
              "Failed to pre-award command XP (async)",
              preXpError,
            );
          }
        });
      }

      // Process command with event handler
      if (commandName === "poll") {
        const eventStart = Date.now();
        this.logger.debug(
          `[CommandHandler] Starting event handler processing at ${eventStart - startTime}ms`,
        );
      }

      await eventHandler.processEvent(
        `command:${commandName}`,
        async () => {
          await command.execute(interaction, client);
        },
        interaction,
        client,
      );

      if (commandName === "poll") {
        const eventEnd = Date.now();
        this.logger.debug(
          `[CommandHandler] Event handler processing completed at ${eventEnd - startTime}ms`,
        );
      }

      const duration = Date.now() - startTime;

      // Record in performance monitor
      try {
        const { getPerformanceMonitor } = await import(
          "../monitoring/performanceMonitor.js"
        );
        getPerformanceMonitor().recordCommand(commandName, duration);
      } catch (perfError) {
        // Ignore stats errors
      }

      this.recordCommand(
        commandName,
        interaction.user.id,
        duration,
        interaction.guild?.id,
      );

      // Award XP for command usage (only for successful commands), unless pre-awarded
      // Make XP processing completely asynchronous to avoid blocking command execution
      if (!command.preAwardXP) {
        setTimeout(async () => {
          try {
            const experienceManager = await getExperienceManager();
            this.logger.info(
              `🎯 Attempting to award XP for command: ${commandName} by user: ${interaction.user.id} in guild: ${interaction.guild.id}`,
            );

            const xpData = await experienceManager.awardCommandXP(
              interaction.guild.id,
              interaction.user.id,
              commandName,
              client,
            );

            if (xpData) {
              this.logger.info(
                `✅ Awarded ${xpData.xp} XP to user ${interaction.user.tag} (${interaction.user.id})`,
              );
              if (xpData.leveledUp) {
                this.logger.info(
                  `🎉 User ${interaction.user.tag} leveled up to level ${xpData.newLevel} from command usage`,
                );
              }
            } else {
              this.logger.info(
                `⏰ User ${interaction.user.tag} is on cooldown for command XP`,
              );
            }
          } catch (xpError) {
            // Don't let XP errors break the command
            this.logger.error("Failed to award command XP (async)", xpError);
          }
        });
      }

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
   * @param {ExtendedInteraction} interaction - Discord interaction object
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
          flags: [MessageFlags.Ephemeral],
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
   * @param {ExtendedInteraction} interaction - Discord interaction object
   * @param {Error & { code?: number | string }} error - The error that occurred
   * @param {number} _duration - Command execution duration
   * @returns {Promise<void>}
   * @example
   * await handler.handleCommandError(interaction, error, 150);
   * // User receives appropriate error message based on error type
   */
  async handleCommandError(interaction, error, _duration) {
    try {
      let errorMessage = "❌ An error occurred while executing the command.";

      // Provide specific error messages for common issues
      const errorCode = "code" in error ? error.code : undefined;

      if (errorCode === 10062) {
        errorMessage = "❌ Command timed out. Please try again.";
      } else if (errorCode === 40060) {
        errorMessage = "❌ Interaction already processed.";
      } else if (error.message.includes("permission")) {
        errorMessage = "❌ You don't have permission to use this command.";
      } else if (error.message.includes("rate limit")) {
        // Try to get remaining time for better error message
        try {
          const { getRateLimitRemainingTime } = await import(
            "../discord/rateLimiter.js"
          );
          const remainingTime = getRateLimitRemainingTime(
            interaction.user.id,
            interaction.commandName,
          );
          const remainingSeconds = Math.ceil(remainingTime / 1000);
          errorMessage = `❌ You're using commands too quickly. Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}.`;
        } catch {
          errorMessage =
            "❌ You're using commands too quickly. Please wait a moment.";
        }
      }

      if (
        !interaction.replied &&
        !interaction.deferred &&
        !interaction._handled
      ) {
        await interaction.reply({
          content: errorMessage,
          flags: [MessageFlags.Ephemeral],
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: errorMessage,
        });
      } else {
        this.logger.warn(
          "Cannot send error response - interaction already handled",
          {
            interactionId: interaction.id,
            replied: interaction.replied,
            deferred: interaction.deferred,
            handled: interaction._handled,
          },
        );
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
   * // ['ping', 'role-reactions', 'help', ...]
   */
  getAllCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Gets all commands from both collections for debugging
   *
   * @returns {Object} Object with commands from both collections
   * @example
   * const allCommands = handler.getAllCommandsDebug();
   * // { handler: ['ping', 'help'], client: ['ping', 'help', 'xp'] }
   */
  getAllCommandsDebug() {
    const handlerCommands = Array.from(this.commands.keys()).sort();
    const clientCommands =
      this.client && this.client.commands
        ? Array.from(this.client.commands.keys()).sort()
        : [];

    return {
      handler: handlerCommands,
      client: clientCommands,
      handlerCount: handlerCommands.length,
      clientCount: clientCommands.length,
      synchronized:
        handlerCommands.length === clientCommands.length &&
        handlerCommands.every(cmd => clientCommands.includes(cmd)),
    };
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

  /**
   * Synchronizes command visibility with Discord for a specific guild
   *
   * Hides disabled commands from the slash command menu by setting
   * permissions for @everyone to false in the target guild.
   *
   * @param {string} guildId - The Discord guild ID to sync
   * @param {Array<string>} disabledCommands - List of command names to hide
   * @returns {Promise<boolean>} Success status
   */
  async syncGuildCommands(guildId, disabledCommands) {
    if (!this.client || !this.client.isReady()) {
      this.logger.warn("⚠️ Cannot sync commands: Client not ready");
      return false;
    }

    try {
      const { REST, Routes } = await import("discord.js");
      const rest = new REST({ version: "10" }).setToken(this.client.token);

      // Get all commands currently registered in the handler
      const allCommands = Array.from(this.commands.values());

      // Filter: only keep commands NOT in the disabled list
      const enabledCommands = allCommands.filter(
        cmd => !disabledCommands.includes(cmd.data.name),
      );

      this.logger.info(
        `� Syncing modular commands to guild ${guildId}: ${enabledCommands.length} enabled, ${allCommands.length - enabledCommands.length} removed from registry.`,
      );

      // Perform a full PUT to the guild command registry
      // This COMPLETELY removes any command not in the body list, including for Admins
      await rest.put(
        Routes.applicationGuildCommands(this.client.user.id, guildId),
        { body: enabledCommands.map(cmd => cmd.data.toJSON()) },
      );

      return true;
    } catch (error) {
      this.logger.error(
        `❌ Error syncing guild commands for ${guildId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Gets performance metrics for the command handler
   * @returns {Promise<Object>} Performance metrics object
   */
  async getPerformanceMetrics() {
    return {
      totalCommands: this.commands.size,
      permissionCacheSize: this.permissionCache.size,
      commandStats: await this.getCommandStats(),
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
