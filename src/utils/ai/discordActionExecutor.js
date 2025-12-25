import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Discord Action Executor - Executes bot commands programmatically from AI actions
 * Note: Admin/moderation/guild management actions are not available (removed from registry for security)
 */
export class DiscordActionExecutor {
  /**
   * Execute a Discord action
   * @param {Object} action - Action object from AI
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Channel} channel - Discord channel
   * @param {import('discord.js').User} user - User who requested the action
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<Object>} Action result
   */
  async executeAction(action, guild, channel, user, client) {
    if (!guild) {
      return {
        success: false,
        error: "Actions can only be performed in servers, not DMs",
      };
    }

    const botMember = guild.members.me;
    if (!botMember) {
      return {
        success: false,
        error: "Bot member not found in server",
      };
    }

    try {
      switch (action.type) {
        case "execute_command":
          return await this.executeCommand(
            action,
            guild,
            channel,
            user,
            client,
          );

        default:
          return {
            success: false,
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      logger.error(`Failed to execute action ${action.type}:`, error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Execute a bot command
   */
  async executeCommand(action, guild, channel, user, client) {
    const { command, subcommand, options = {} } = action;

    if (!command) {
      return { success: false, error: "Command name is required" };
    }

    try {
      // Import command executor
      const { executeCommandProgrammatically } = await import(
        "./commandExecutor.js"
      );

      const result = await executeCommandProgrammatically({
        commandName: command,
        subcommand,
        options,
        user,
        guild,
        channel,
        client,
      });

      return {
        success: true,
        result: result.response || "Command executed successfully",
        command,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to execute command",
      };
    }
  }
}

// Export singleton instance
export const discordActionExecutor = new DiscordActionExecutor();
