import { getLogger } from "../logger.js";
import {
  getActionConfig,
  actionRequiresGuild,
  validateActionOptions,
} from "./actionRegistry.js";
import { AI_AUDIT_LOGGING_ENABLED } from "./constants.js";

const logger = getLogger();

// Simple inline data fetcher (replaces deleted dataFetcher)
const dataFetcher = {
  getMemberInfo: async (guild, options) => {
    let member = null;
    if (options.user_id) {
      member = guild.members.cache.get(options.user_id);
      if (!member) {
        try {
          member = await guild.members.fetch(options.user_id);
        } catch (_e) {}
      }
    } else if (options.username) {
      member = guild.members.cache.find(
        m => m.user.username.toLowerCase() === options.username.toLowerCase(),
      );
      if (!member) {
        try {
          const members = await guild.members.fetch({
            query: options.username,
            limit: 1,
          });
          member = members.first();
        } catch (_e) {}
      }
    }
    if (!member) return `Member not found.`;
    const roles = member.roles.cache
      .filter(r => r.name !== "@everyone")
      .map(r => r.name);
    return `User: ${member.user.username} (${member.user.id})\nJoined: ${member.joinedAt?.toDateString() || "Unknown"}\nRoles: ${roles.join(", ") || "None"}`;
  },
  getRoleInfo: async (guild, options) => {
    let role = null;
    if (options.role_id) {
      role = guild.roles.cache.get(options.role_id);
      if (!role) {
        try {
          role = await guild.roles.fetch(options.role_id);
        } catch (_e) {}
      }
    } else if (options.role_name) {
      role = guild.roles.cache.find(
        r => r.name.toLowerCase() === options.role_name.toLowerCase(),
      );
      if (!role) {
        try {
          await guild.roles.fetch();
          role = guild.roles.cache.find(
            r => r.name.toLowerCase() === options.role_name.toLowerCase(),
          );
        } catch (_e) {}
      }
    }
    if (!role) return `Role not found.`;
    return `Role: ${role.name} (${role.id})\nColor: ${role.hexColor}\nMembers: ${role.members.size}\nPosition: ${role.position}\nMentionable: ${role.mentionable}\nHoisted: ${role.hoist}`;
  },
  getChannelInfo: async (guild, options) => {
    let channel = null;
    if (options.channel_id) {
      channel = guild.channels.cache.get(options.channel_id);
      if (!channel) {
        try {
          channel = await guild.channels.fetch(options.channel_id);
        } catch (_e) {}
      }
    } else if (options.channel_name) {
      channel = guild.channels.cache.find(
        c => c.name.toLowerCase() === options.channel_name.toLowerCase(),
      );
      if (!channel) {
        try {
          await guild.channels.fetch();
          channel = guild.channels.cache.find(
            c => c.name.toLowerCase() === options.channel_name.toLowerCase(),
          );
        } catch (_e) {}
      }
    }
    if (!channel) return `Channel not found.`;
    return `Channel: #${channel.name} (${channel.id})\nType: ${channel.type}\nCategory: ${channel.parent?.name || "None"}\nPosition: ${channel.position}`;
  },
  searchMembersByRole: async (guild, options) => {
    let role = null;
    if (options.role_id) {
      role = guild.roles.cache.get(options.role_id);
      if (!role) {
        try {
          role = await guild.roles.fetch(options.role_id);
        } catch (_e) {}
      }
    } else if (options.role_name) {
      role = guild.roles.cache.find(
        r => r.name.toLowerCase() === options.role_name.toLowerCase(),
      );
    }
    if (!role) return [];
    return role.members.map(m => ({
      username: m.user.username,
      id: m.user.id,
      joinedAt: m.joinedAt?.toDateString() || "Unknown",
    }));
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
      errorLower.includes("do not have permission")
    ) {
      return `This command is not allowed for AI execution. It may be on the blocklist, or the requesting user lacks permission. Check the user's allowed commands list in the error message.`;
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
   * Log an AI action for audit purposes
   * @param {string} actionType - The type of action
   * @param {Object} action - Full action object
   * @param {import('discord.js').User} user - User who triggered the action
   * @param {import('discord.js').Guild} guild - Guild context
   * @param {string} result - Result description
   * @param {boolean} success - Whether the action succeeded
   */
  static logAuditAction(actionType, action, user, guild, result, success) {
    if (!AI_AUDIT_LOGGING_ENABLED) return;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      actionType,
      command: action.command || null,
      subcommand: action.subcommand || null,
      options: action.options || null,
      userId: user?.id || "unknown",
      username: user?.username || "unknown",
      guildId: guild?.id || "unknown",
      guildName: guild?.name || "unknown",
      result: result.substring(0, 200), // Truncate for log safety
      success,
    };

    if (success) {
      logger.info(`[AI_AUDIT] ${JSON.stringify(auditEntry)}`);
    } else {
      logger.warn(`[AI_AUDIT] ${JSON.stringify(auditEntry)}`);
    }
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
                  .map(
                    (m, idx) =>
                      `${idx + 1}. ${m.username} (${m.id}) - Joined: ${m.joinedAt}`,
                  )
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
                  logger.info(
                    `[executeStructuredActions] Command ${action.command} executed and sent response to channel`,
                  );
                  const resultMsg = `Command Result: /${commandName}${subcommand ? ` ${subcommand}` : ""} executed successfully`;
                  results.push(resultMsg);

                  // Audit log
                  ActionExecutor.logAuditAction(
                    action.type,
                    action,
                    user,
                    guild,
                    resultMsg,
                    true,
                  );
                } else {
                  // Include detailed error information for AI to learn from
                  const errorMsg = result.error || "Unknown error";
                  const guidance = await ActionExecutor.getCommandErrorGuidance(
                    errorMsg,
                    action,
                  );
                  const resultMsg = `Command Error: Failed to execute command "${action.command}"${action.subcommand ? ` with subcommand "${action.subcommand}"` : ""}. Error: ${errorMsg}. ${guidance}`;
                  results.push(resultMsg);

                  // Audit log
                  ActionExecutor.logAuditAction(
                    action.type,
                    action,
                    user,
                    guild,
                    resultMsg,
                    false,
                  );
                }
              } catch (error) {
                // Include detailed error information for AI to learn from
                const errorMsg = error.message || "Unknown error";
                const guidance = await ActionExecutor.getCommandErrorGuidance(
                  errorMsg,
                  action,
                );
                const resultMsg = `Command Error: Error executing command "${action.command}"${action.subcommand ? ` with subcommand "${action.subcommand}"` : ""}. Error: ${errorMsg}. ${guidance}`;
                results.push(resultMsg);

                // Audit log
                ActionExecutor.logAuditAction(
                  action.type,
                  action,
                  user,
                  guild,
                  resultMsg,
                  false,
                );
              }
            }
            break;

          // Note: Direct Discord API actions (send_message, add_role, kick_member, etc.)
          // are NOT in the action registry. For safety, the AI executes server management
          // through existing bot commands via admin-delegated permissions instead.
          // Destructive commands (moderation) are blocked via AI_ADMIN_COMMAND_BLOCKLIST.

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
