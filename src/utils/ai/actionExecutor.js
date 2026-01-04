import { getLogger } from "../logger.js";
import {
  getActionConfig,
  actionRequiresGuild,
  validateActionOptions,
} from "./actionRegistry.js";

const logger = getLogger();

// Simple inline data fetcher (replaces deleted dataFetcher)
const dataFetcher = {
  getMemberInfo: async (guild, options) => {
    const member = options.user_id
      ? guild.members.cache.get(options.user_id)
      : guild.members.cache.find(m => m.user.username === options.username);
    if (!member) return null;
    return `${member.user.username} (${member.user.id}) - Joined: ${member.joinedAt?.toDateString() || "Unknown"}`;
  },
  getRoleInfo: async (guild, options) => {
    const role = options.role_id
      ? guild.roles.cache.get(options.role_id)
      : guild.roles.cache.find(r => r.name === options.role_name);
    if (!role) return null;
    return `${role.name} (${role.id}) - Members: ${role.members.size}`;
  },
  getChannelInfo: async (guild, options) => {
    const channel = options.channel_id
      ? guild.channels.cache.get(options.channel_id)
      : guild.channels.cache.find(c => c.name === options.channel_name);
    if (!channel) return null;
    return `${channel.name} (${channel.id}) - Type: ${channel.type}`;
  },
  searchMembersByRole: async (guild, options) => {
    const role = options.role_id
      ? guild.roles.cache.get(options.role_id)
      : guild.roles.cache.find(r => r.name === options.role_name);
    if (!role) return [];
    return role.members.map(m => m.user.username);
  },
  handleDynamicDataFetching: async (actionType, guild, _client) => {
    // Simple implementation for dynamic data fetching
    if (actionType === "get_server_info" && guild) {
      return `Server: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`;
    }
    return null;
  },
  smartMemberFetch: async (_guild, _userMessage) => {
    // Member fetching has been removed - guide users to Discord's built-in features
    return {
      fetched: false,
      reason: "Member fetching disabled - guide users to Discord's member list",
    };
  },
};

/**
 * Action Executor for AI chat service
 * Handles validation and execution of AI actions
 */
export class ActionExecutor {
  /**
   * Validate an action structure
   * @param {Object} action - Action object to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  static validateAction(action) {
    if (!action || typeof action !== "object") {
      return { isValid: false, error: "Action must be an object" };
    }

    if (!action.type || typeof action.type !== "string") {
      return { isValid: false, error: "Action must have a 'type' field" };
    }

    // Use action registry for validation
    const validation = validateActionOptions(action);
    if (!validation.isValid) {
      return validation;
    }

    // Handle dynamic actions (get_* that aren't in registry)
    if (action.type.startsWith("get_") && !getActionConfig(action.type)) {
      // Dynamic actions don't require options validation
      return { isValid: true, error: null };
    }

    return { isValid: true, error: null };
  }

  /**
   * Get guidance for command errors to help AI understand what went wrong
   * @param {string} errorMessage - Error message
   * @param {Object} action - Action that failed
   * @returns {Promise<string>} Guidance message
   */
  static async getCommandErrorGuidance(errorMessage, action) {
    const errorLower = errorMessage.toLowerCase();
    const command = action.command || "unknown";

    // Command not allowed
    if (
      errorLower.includes("not allowed") ||
      errorLower.includes("only execute general")
    ) {
      // Dynamically discover general commands instead of hardcoding
      try {
        const { getGeneralCommands } = await import(
          "./commandExecutor/commandDiscovery.js"
        );
        const generalCommands = await getGeneralCommands();
        return `This command is not in the general commands list. AI can only execute commands from /src/commands/general. Available general commands: ${generalCommands.join(", ")}. If you need to use "${command}", it's likely an admin or developer command that must be run manually by a user.`;
      } catch (error) {
        logger.error(
          "Failed to get general commands for error guidance:",
          error,
        );
        return `This command is not in the general commands list. AI can only execute commands from /src/commands/general. Check the available commands using /help.`;
      }
    }

    // Subcommand not allowed
    if (
      errorLower.includes("subcommand") &&
      errorLower.includes("not allowed")
    ) {
      return `The subcommand "${action.subcommand}" doesn't exist for command "${command}". Check the command structure - some commands don't have subcommands (like /rps, /wyr, /ping).`;
    }

    // User not found
    if (
      errorLower.includes("user") &&
      (errorLower.includes("not found") || errorLower.includes("invalid"))
    ) {
      return `The user ID or mention provided is invalid or the user doesn't exist. Use actual user IDs from the server member list, or use mention format like "<@123456789012345678>".`;
    }

    // Missing required options
    if (errorLower.includes("required") || errorLower.includes("missing")) {
      return `Required options are missing. Check the command structure - all required options must be provided.`;
    }

    // Invalid option values
    if (errorLower.includes("invalid") || errorLower.includes("not valid")) {
      return `One or more option values are invalid. Check the command's expected option types and values (e.g., choices must match predefined values, user options must be valid user IDs).`;
    }

    // Generic guidance
    return `Review the command structure and options. Ensure all required options are provided with correct types and values.`;
  }

  /**
   * Execute structured actions from AI response
   * @param {Array} actions - Array of action objects
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {import('discord.js').User} user - User who triggered the action
   * @param {import('discord.js').Channel} channel - Channel where action was triggered
   * @returns {Promise<{results: Array<string>, commandResponses: Array<{command: string, response: object}>}>}
   */
  static async executeStructuredActions(actions, guild, client, user, channel) {
    const results = [];
    // Commands now send responses directly to channel, no need to store them

    // Validate actions array
    if (!Array.isArray(actions)) {
      logger.warn("[executeStructuredActions] Actions is not an array");
      return {
        results: ["Invalid actions format: expected an array"],
        commandResponses: [],
      };
    }

    for (const action of actions) {
      // Validate action structure
      const validation = ActionExecutor.validateAction(action);
      if (!validation.isValid) {
        logger.warn(
          `[executeStructuredActions] Invalid action: ${validation.error}`,
        );
        results.push(`Invalid action: ${validation.error}`);
        continue;
      }

      // Check if guild is required for this action (using registry)
      if (actionRequiresGuild(action.type) && !guild) {
        results.push(
          `${action.type} requires a server context (cannot be used in DMs)`,
        );
        continue;
      }

      try {
        switch (action.type) {
          case "fetch_channels":
            if (!guild) {
              results.push("Cannot fetch channels: not in a server");
              break;
            }
            await guild.channels.fetch();
            results.push("Fetched all channels");
            break;

          case "fetch_roles":
            if (!guild) {
              results.push("Cannot fetch roles: not in a server");
              break;
            }
            await guild.roles.fetch();
            results.push("Fetched all roles");
            break;

          case "fetch_all":
            if (!guild) {
              results.push("Error: Cannot fetch data - not in a server");
              break;
            }
            try {
              // Note: Member fetching has been removed for security and performance
              // Only fetch channels and roles now
              await guild.channels.fetch();
              await guild.roles.fetch();
              results.push(
                "Success: Fetched server data (channels, roles). For member information, users should check Discord's member list.",
              );
            } catch (error) {
              const errorMessage = error.message || "Unknown error occurred";
              logger.error(
                `[fetch_all] Unexpected error: ${errorMessage}`,
                error,
              );
              results.push(
                `Error: Failed to fetch server data - ${errorMessage}`,
              );
            }
            break;

          case "get_member_info":
            if (!guild) {
              results.push("Cannot get member info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.user_id && !action.options.username)
            ) {
              results.push(
                "get_member_info requires 'user_id' or 'username' in options",
              );
              break;
            }
            {
              const memberInfo = await dataFetcher.getMemberInfo(
                guild,
                action.options,
              );
              if (memberInfo) {
                results.push(`Data: ${memberInfo}`);
              } else {
                results.push("Member not found");
              }
            }
            break;

          case "get_role_info":
            if (!guild) {
              results.push("Cannot get role info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "get_role_info requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const roleInfo = await dataFetcher.getRoleInfo(
                guild,
                action.options,
              );
              if (roleInfo) {
                results.push(`Data: ${roleInfo}`);
              } else {
                results.push("Role not found");
              }
            }
            break;

          case "get_channel_info":
            if (!guild) {
              results.push("Cannot get channel info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.channel_id && !action.options.channel_name)
            ) {
              results.push(
                "get_channel_info requires 'channel_id' or 'channel_name' in options",
              );
              break;
            }
            {
              const channelInfo = await dataFetcher.getChannelInfo(
                guild,
                action.options,
              );
              if (channelInfo) {
                results.push(`Data: ${channelInfo}`);
              } else {
                results.push("Channel not found");
              }
            }
            break;

          case "search_members_by_role":
            if (!guild) {
              results.push("Cannot search members: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "search_members_by_role requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const members = await dataFetcher.searchMembersByRole(
                guild,
                action.options,
              );
              if (members && members.length > 0) {
                const memberList = members
                  .map((name, idx) => `${idx + 1}. ${name}`)
                  .join("\n");
                results.push(
                  `Found: ${members.length} member(s) with that role:\n${memberList}`,
                );
              } else {
                results.push("No members found with that role");
              }
            }
            break;

          case "execute_command":
            if (!guild) {
              results.push("Cannot execute command: not in a server");
              break;
            }
            if (!action.command) {
              results.push("execute_command requires a 'command' field");
              break;
            }
            {
              try {
                const { executeCommandProgrammatically } = await import(
                  "./commandExecutor.js"
                );

                // Parse command name - handle cases where AI puts "command subcommand" in command field
                // e.g., "poll create" should become command="poll", subcommand="create"
                let commandName = action.command;
                let subcommand =
                  action.subcommand ||
                  (action.options && action.options.subcommand) ||
                  null;

                // If command name contains a space, split it into command and subcommand
                if (commandName.includes(" ") && !subcommand) {
                  const parts = commandName.split(" ");
                  commandName = parts[0];
                  subcommand = parts.slice(1).join(" ");
                  logger.debug(
                    `[executeStructuredActions] Parsed command "${action.command}" into command="${commandName}", subcommand="${subcommand}"`,
                  );
                }

                // Remove subcommand from options if it's there (it's not a real option)
                const cleanOptions = { ...(action.options || {}) };
                if (cleanOptions.subcommand) {
                  delete cleanOptions.subcommand;
                }

                const result = await executeCommandProgrammatically({
                  commandName,
                  subcommand,
                  options: cleanOptions,
                  user,
                  guild,
                  channel,
                  client,
                });
                if (result.success) {
                  // Command has already sent its response directly to the channel
                  // We just need to mark it as executed for the AI context
                  logger.info(
                    `[executeStructuredActions] Command ${action.command} executed and sent response to channel`,
                  );
                  results.push(
                    `Command Result: Command ${action.command} executed successfully`,
                  );
                } else {
                  // Include detailed error information for AI to learn from
                  const errorMsg = result.error || "Unknown error";
                  const guidance = await ActionExecutor.getCommandErrorGuidance(
                    errorMsg,
                    action,
                  );
                  results.push(
                    `Command Error: Failed to execute command "${action.command}"${action.subcommand ? ` with subcommand "${action.subcommand}"` : ""}. Error: ${errorMsg}. ${guidance}`,
                  );
                }
              } catch (error) {
                // Include detailed error information for AI to learn from
                const errorMsg = error.message || "Unknown error";
                const guidance = await ActionExecutor.getCommandErrorGuidance(
                  errorMsg,
                  action,
                );
                results.push(
                  `Command Error: Error executing command "${action.command}"${action.subcommand ? ` with subcommand "${action.subcommand}"` : ""}. Error: ${errorMsg}. ${guidance}`,
                );
              }
            }
            break;

          // Note: Admin/moderation/guild management actions are not in the action registry
          // These actions (send_message, add_role, remove_role, delete_message, pin_message,
          // unpin_message, create_channel, delete_channel, modify_channel, kick_member,
          // ban_member, timeout_member, warn_member) are not available because anyone can use the AI
          // They must be performed manually by administrators using bot commands

          default:
            // Check if this is a dynamic data fetching action
            if (
              action.type.startsWith("get_") &&
              action.type !== "get_member_info" &&
              action.type !== "get_role_info" &&
              action.type !== "get_channel_info" &&
              action.type !== "search_members_by_role"
            ) {
              const handled = await dataFetcher.handleDynamicDataFetching(
                action.type,
                guild,
                client,
              );
              if (handled !== null) {
                results.push(handled);
                break;
              }
            }
            logger.warn(`Unknown action type: ${action.type}`);
            results.push(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error);
        results.push(
          `Failed to execute ${action.type}: ${error.message || "Unknown error"}`,
        );
      }
    }

    return { results, commandResponses: [] }; // Commands send directly, no need to return them
  }
}

// Export singleton instance for convenience
export const actionExecutor = ActionExecutor;
