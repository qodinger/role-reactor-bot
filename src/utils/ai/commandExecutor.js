import { getLogger } from "../logger.js";
import { getCommandHandler } from "../core/commandHandler.js";
import {
  getGeneralCommands,
  getAllowedCommands,
} from "./commandExecutor/commandDiscovery.js";
import { createMockInteraction } from "./commandExecutor/mockInteraction.js";
import { canExecuteCommand } from "./commandExecutor/commandValidator.js";

const logger = getLogger();

// Re-export functions from extracted modules for backward compatibility
export {
  getGeneralCommands,
  getGeneralCommandsSync,
  getAdminCommands,
  getDeveloperCommands,
  getAllowedCommands,
} from "./commandExecutor/commandDiscovery.js";

export {
  canExecuteCommand,
  getExecutableCommands,
} from "./commandExecutor/commandValidator.js";

/**
 * Get guidance for execution errors to help AI understand what went wrong
 * @param {Error} error - Error object
 * @param {string} _commandName - Command name (unused but kept for API consistency)
 * @param {string} _subcommand - Optional subcommand (unused but kept for API consistency)
 * @returns {string} Guidance message
 * @private
 */
function getExecutionErrorGuidance(error, _commandName, _subcommand) {
  const errorMsg = error.message?.toLowerCase() || "";

  // Interaction errors (command handler issues)
  if (errorMsg.includes("interaction") || errorMsg.includes("defer")) {
    return `The command handler encountered an issue. This might be due to invalid options or command structure.`;
  }

  // Permission errors
  if (errorMsg.includes("permission") || errorMsg.includes("missing")) {
    return `The bot may lack required permissions to execute this command in this server.`;
  }

  // User/option resolution errors
  if (errorMsg.includes("user") || errorMsg.includes("option")) {
    return `One or more options could not be resolved. Ensure all option values are valid (e.g., user IDs must exist, choice values must match predefined options).`;
  }

  // Generic guidance
  return `Check the command structure, required options, and option values. Ensure the command exists and all required options are provided correctly.`;
}

/**
 * Execute a command programmatically on behalf of a user
 * @param {Object} params
 * @param {string} params.commandName - Command name
 * @param {string} params.subcommand - Optional subcommand
 * @param {Object} params.options - Command options
 * @param {import('discord.js').User} params.user - User executing the command
 * @param {import('discord.js').Guild} params.guild - Guild where command is executed
 * @param {import('discord.js').Channel} params.channel - Channel where command is executed
 * @param {import('discord.js').Client} params.client - Discord client
 * @returns {Promise<Object>} Command execution result with response data
 */
export async function executeCommandProgrammatically({
  commandName,
  subcommand = null,
  options = {},
  user,
  guild,
  channel,
  client,
}) {
  // Parse command name - handle cases where AI puts "command subcommand" in commandName
  // e.g., "poll create" should become commandName="poll", subcommand="create"
  let parsedCommandName = commandName;
  let parsedSubcommand = subcommand;

  if (commandName.includes(" ") && !subcommand) {
    const parts = commandName.split(" ");
    parsedCommandName = parts[0];
    parsedSubcommand = parts.slice(1).join(" ");
    logger.debug(
      `[executeCommandProgrammatically] Parsed command "${commandName}" into command="${parsedCommandName}", subcommand="${parsedSubcommand}"`,
    );
  }

  // Check if command is allowed (only general commands)
  const isAllowed = await canExecuteCommand(
    parsedCommandName,
    parsedSubcommand,
    client,
  );
  if (!isAllowed) {
    const generalCommands = await getGeneralCommands();
    throw new Error(
      `Command "${commandName}" is not allowed. AI can only execute general commands for safety. Available general commands: ${generalCommands.join(", ")}. If you need to use "${commandName}", it's likely an admin or developer command that must be run manually by a user.`,
    );
  }

  // Get command config for subcommand validation
  const ALLOWED_COMMANDS = await getAllowedCommands(client);
  const commandConfig = ALLOWED_COMMANDS[parsedCommandName];

  // Check subcommand if provided (use parsed subcommand)
  if (parsedSubcommand && commandConfig?.subcommands) {
    // Handle subcommand groups (e.g., "group subcommand")
    const normalizedSubcommand = parsedSubcommand.replace(/\s+/g, " ");
    if (
      !commandConfig.subcommands.includes(parsedSubcommand) &&
      !commandConfig.subcommands.includes(normalizedSubcommand)
    ) {
      const validSubcommands = commandConfig.subcommands.join(", ");
      throw new Error(
        `Subcommand "${parsedSubcommand}" is not valid for command "${parsedCommandName}". Valid subcommands are: ${validSubcommands}. If no subcommands are listed, this command doesn't use subcommands - remove the "subcommand" field from your action.`,
      );
    }
  } else if (parsedSubcommand && !commandConfig?.subcommands) {
    // Command doesn't have subcommands but one was provided
    throw new Error(
      `Command "${parsedCommandName}" does not have subcommands. Remove the "subcommand" field from your action and use only "command" and "options".`,
    );
  } else if (
    !parsedSubcommand &&
    commandConfig?.subcommands &&
    commandConfig.subcommands.length > 0
  ) {
    // Command requires subcommands but none was provided
    const validSubcommands = commandConfig.subcommands.join(", ");
    throw new Error(
      `Command "${parsedCommandName}" requires a subcommand. Valid subcommands are: ${validSubcommands}. Add a "subcommand" field to your action with one of these values.`,
    );
  }

  try {
    // Resolve user options before creating interaction (for async resolution)
    const resolvedOptions = { ...options };
    let executorUser = user; // Default: requester executes the command

    for (const [key, value] of Object.entries(options)) {
      // Check if this is a user option by checking command structure
      // For RPS, "user" is a user option (no subcommands anymore)
      if (key === "user" && parsedCommandName === "rps") {
        if (value && typeof value === "string") {
          // Extract user ID from mention format: <@123456789> or <@!123456789>
          const mentionMatch = value.match(/<@!?(\d+)>/);
          const userId = mentionMatch ? mentionMatch[1] : value;

          // Try cache first
          let resolvedUser = client?.users.cache.get(userId);
          if (!resolvedUser && guild) {
            const member = guild.members.cache.get(userId);
            if (member) {
              resolvedUser = member.user;
            }
          }

          // If not in cache, try to fetch
          if (!resolvedUser && client) {
            try {
              if (guild) {
                const member = await guild.members.fetch(userId);
                resolvedUser = member.user;
              } else {
                resolvedUser = await client.users.fetch(userId);
              }
            } catch (error) {
              logger.debug(
                `Failed to fetch user ${userId} for RPS challenge:`,
                error.message,
              );
            }
          }

          if (resolvedUser) {
            resolvedOptions[key] = resolvedUser;

            // Special case: If RPS is challenging the requester, the bot should execute it
            // This allows the bot to challenge the user who asked
            if (resolvedUser.id === user.id && client?.user) {
              executorUser = client.user; // Bot executes the command
              logger.debug(
                `[RPS] Bot challenging requester ${user.id} - using bot as executor`,
              );
            }
          }
        }
      }
    }

    // Create mock interaction
    const interaction = createMockInteraction({
      commandName: parsedCommandName,
      subcommand: parsedSubcommand,
      options: resolvedOptions,
      user: executorUser, // Use bot if challenging requester, otherwise requester
      guild,
      channel,
      client,
      commandConfig, // Pass command config for getSubcommand validation
    });

    // Execute the command - it will send its own response directly to the channel
    const commandHandler = getCommandHandler();
    try {
      await commandHandler.executeCommand(interaction, client);
    } catch (commandError) {
      // Command execution failed - re-throw with context
      logger.error(
        `[executeCommandProgrammatically] Command ${commandName} execution failed:`,
        commandError,
      );
      throw new Error(
        `Command "${commandName}" execution failed: ${commandError.message || "Unknown error"}. This usually means required options are missing or invalid. Check the command structure and ensure all required options are provided.`,
      );
    }

    // Wait a bit for async operations to complete
    await new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 500);
    });

    // Command has already sent its response to the channel
    // We don't need to capture or return it - it's already sent!
    logger.debug(
      `[executeCommandProgrammatically] Command ${commandName} executed and sent response to channel`,
    );

    return {
      success: true,
      command: parsedCommandName,
      subcommand: parsedSubcommand,
      // No response data needed - command sent it directly
    };
  } catch (error) {
    logger.error(
      `Failed to execute command ${commandName} programmatically:`,
      error,
    );
    // Re-throw with enhanced error message for AI learning
    const enhancedError = new Error(
      error.message ||
        `Failed to execute command "${commandName}". ${getExecutionErrorGuidance(error, commandName, subcommand)}`,
    );
    enhancedError.stack = error.stack;
    throw enhancedError;
  }
}
