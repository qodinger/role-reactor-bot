import { ChatInputCommandInteraction } from "discord.js";
import { getLogger } from "../logger.js";
import { getCommandHandler } from "../core/commandHandler.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const logger = getLogger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fallback list of general commands (used if discovery fails)
 * This should match commands in src/commands/general
 */
const FALLBACK_GENERAL_COMMANDS = [
  "8ball",
  "ask",
  "avatar",
  "core",
  "help",
  "invite",
  "leaderboard",
  "level",
  "ping",
  "poll",
  "rps",
  "serverinfo",
  "sponsor",
  "support",
  "userinfo",
  "wyr",
];

/**
 * Cache for general commands list
 */
let GENERAL_COMMANDS_CACHE = null;

/**
 * Dynamically discover general commands from src/commands/general directory
 * This automatically finds all commands in the general folder
 * @returns {Promise<Array<string>>} Array of general command names
 */
async function discoverGeneralCommands() {
  // Return cached version if available
  if (GENERAL_COMMANDS_CACHE) {
    return GENERAL_COMMANDS_CACHE;
  }

  try {
    const generalCommandsPath = path.join(__dirname, "../../commands/general");

    // Check if directory exists
    try {
      await fs.access(generalCommandsPath);
    } catch {
      logger.warn("General commands directory not found, using fallback list");
      GENERAL_COMMANDS_CACHE = [...FALLBACK_GENERAL_COMMANDS];
      return GENERAL_COMMANDS_CACHE;
    }

    const items = await fs.readdir(generalCommandsPath);

    // Parallelize file system operations for better performance
    const itemChecks = await Promise.all(
      items.map(async item => {
        const itemPath = path.join(generalCommandsPath, item);
        try {
          const stats = await fs.stat(itemPath);
          if (!stats.isDirectory()) return null;

          // Check if this directory has an index.js file (command file)
          const indexPath = path.join(itemPath, "index.js");
          try {
            await fs.access(indexPath);
            return item; // Valid command directory
          } catch {
            return null; // No index.js, skip
          }
        } catch {
          return null; // Can't stat, skip
        }
      }),
    );

    // Filter out nulls and get command names
    const commandNames = itemChecks.filter(name => name !== null);

    // Sort alphabetically for consistency
    commandNames.sort();

    // Cache the result
    GENERAL_COMMANDS_CACHE = commandNames;
    logger.debug(
      `Discovered ${commandNames.length} general commands: ${commandNames.join(", ")}`,
    );

    return commandNames;
  } catch (error) {
    logger.error("Failed to discover general commands:", error);
    GENERAL_COMMANDS_CACHE = [...FALLBACK_GENERAL_COMMANDS];
    return GENERAL_COMMANDS_CACHE;
  }
}

/**
 * Get general commands list (synchronous version for immediate use)
 * Uses cached version if available, otherwise returns fallback
 * @returns {Array<string>} Array of general command names
 */
export function getGeneralCommandsSync() {
  if (GENERAL_COMMANDS_CACHE) {
    return GENERAL_COMMANDS_CACHE;
  }
  // Fallback list until async discovery completes
  return [...FALLBACK_GENERAL_COMMANDS];
}

/**
 * Get general commands list (async version for dynamic discovery)
 * @returns {Promise<Array<string>>} Array of general command names
 */
export async function getGeneralCommands() {
  return await discoverGeneralCommands();
}

/**
 * Cache for admin commands list
 */
let ADMIN_COMMANDS_CACHE = null;

/**
 * Dynamically discover admin commands from src/commands/admin directory
 * @returns {Promise<Array<string>>} Array of admin command names
 */
async function discoverAdminCommands() {
  if (ADMIN_COMMANDS_CACHE) {
    return ADMIN_COMMANDS_CACHE;
  }

  try {
    const adminCommandsPath = path.join(__dirname, "../../commands/admin");
    try {
      await fs.access(adminCommandsPath);
    } catch {
      ADMIN_COMMANDS_CACHE = [];
      return ADMIN_COMMANDS_CACHE;
    }

    const items = await fs.readdir(adminCommandsPath);
    const itemChecks = await Promise.all(
      items.map(async item => {
        const itemPath = path.join(adminCommandsPath, item);
        try {
          const stats = await fs.stat(itemPath);
          if (!stats.isDirectory()) return null;
          const indexPath = path.join(itemPath, "index.js");
          try {
            await fs.access(indexPath);
            return item;
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      }),
    );

    const commandNames = itemChecks.filter(name => name !== null).sort();
    ADMIN_COMMANDS_CACHE = commandNames;
    logger.debug(
      `Discovered ${commandNames.length} admin commands: ${commandNames.join(", ")}`,
    );
    return commandNames;
  } catch (error) {
    logger.error("Failed to discover admin commands:", error);
    ADMIN_COMMANDS_CACHE = [];
    return ADMIN_COMMANDS_CACHE;
  }
}

/**
 * Get admin commands list
 * @returns {Promise<Array<string>>} Array of admin command names
 */
export async function getAdminCommands() {
  return await discoverAdminCommands();
}

/**
 * Cache for developer commands list
 */
let DEVELOPER_COMMANDS_CACHE = null;

/**
 * Dynamically discover developer commands from src/commands/developer directory
 * @returns {Promise<Array<string>>} Array of developer command names
 */
async function discoverDeveloperCommands() {
  if (DEVELOPER_COMMANDS_CACHE) {
    return DEVELOPER_COMMANDS_CACHE;
  }

  try {
    const developerCommandsPath = path.join(
      __dirname,
      "../../commands/developer",
    );
    try {
      await fs.access(developerCommandsPath);
    } catch {
      DEVELOPER_COMMANDS_CACHE = [];
      return DEVELOPER_COMMANDS_CACHE;
    }

    const items = await fs.readdir(developerCommandsPath);
    const itemChecks = await Promise.all(
      items.map(async item => {
        const itemPath = path.join(developerCommandsPath, item);
        try {
          const stats = await fs.stat(itemPath);
          if (!stats.isDirectory()) return null;
          const indexPath = path.join(itemPath, "index.js");
          try {
            await fs.access(indexPath);
            return item;
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      }),
    );

    const commandNames = itemChecks.filter(name => name !== null).sort();
    DEVELOPER_COMMANDS_CACHE = commandNames;
    logger.debug(
      `Discovered ${commandNames.length} developer commands: ${commandNames.join(", ")}`,
    );
    return commandNames;
  } catch (error) {
    logger.error("Failed to discover developer commands:", error);
    DEVELOPER_COMMANDS_CACHE = [];
    return DEVELOPER_COMMANDS_CACHE;
  }
}

/**
 * Get developer commands list
 * @returns {Promise<Array<string>>} Array of developer command names
 */
export async function getDeveloperCommands() {
  return await discoverDeveloperCommands();
}

/**
 * Commands the AI is allowed to execute
 * AI can ONLY execute general commands for safety
 * This is dynamically built from commands in src/commands/general
 */
let ALLOWED_COMMANDS_CACHE = null;

/**
 * Build allowed commands list dynamically from general commands
 * @param {import('discord.js').Client} client - Discord client (optional)
 * @returns {Promise<Object>} Allowed commands configuration
 */
async function buildAllowedCommands(client = null) {
  // Return cached version if available and client hasn't changed
  if (ALLOWED_COMMANDS_CACHE && !client) {
    return ALLOWED_COMMANDS_CACHE;
  }

  // Get dynamically discovered general commands (cached after first call)
  const generalCommands = await getGeneralCommands();
  const allowedCommands = {};

  // Get all commands from client if available
  if (client?.commands) {
    // Process commands in parallel for better performance
    const commandConfigs = await Promise.all(
      generalCommands.map(async commandName => {
        const command = client.commands.get(commandName);
        if (!command || !command.data) return null;

        const cmdData =
          typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;

        const config = {
          allowed: true,
          description: cmdData.description || "No description available",
        };

        // Extract subcommands
        const options = cmdData.options || [];
        const subcommands = [];
        for (const option of options) {
          if (option.type === 1) {
            // Subcommand
            subcommands.push(option.name);
          } else if (option.type === 2) {
            // Subcommand group
            if (option.options) {
              for (const subcmd of option.options) {
                if (subcmd.type === 1) {
                  subcommands.push(`${option.name} ${subcmd.name}`);
                }
              }
            }
          }
        }

        if (subcommands.length > 0) {
          config.subcommands = subcommands;
        }

        return { name: commandName, config };
      }),
    );

    // Build allowedCommands object from results
    for (const result of commandConfigs) {
      if (result) {
        allowedCommands[result.name] = result.config;
      }
    }
  } else {
    // Fallback: use discovered list if client not available
    for (const commandName of generalCommands) {
      allowedCommands[commandName] = {
        allowed: true,
        description: `General command: ${commandName}`,
      };
    }
  }

  // Cache the result
  ALLOWED_COMMANDS_CACHE = allowedCommands;
  return allowedCommands;
}

/**
 * Get allowed commands (with client for dynamic discovery)
 * @param {import('discord.js').Client} client - Discord client (optional)
 * @returns {Promise<Object>} Allowed commands configuration
 */
async function getAllowedCommands(client = null) {
  return await buildAllowedCommands(client);
}

/**
 * Create a mock interaction for programmatic command execution
 * @param {Object} params
 * @param {string} params.commandName - Command name
 * @param {string} params.subcommand - Optional subcommand
 * @param {Object} params.options - Command options
 * @param {import('discord.js').User} params.user - User executing the command
 * @param {import('discord.js').Guild} params.guild - Guild where command is executed
 * @param {import('discord.js').Channel} params.channel - Channel where command is executed
 * @param {import('discord.js').Client} params.client - Discord client
 * @returns {ChatInputCommandInteraction} Mock interaction
 */
function createMockInteraction({
  commandName,
  subcommand = null,
  options = {},
  user,
  guild,
  channel,
  client,
}) {
  // Build options array for Discord.js format
  const optionsArray = [];

  // Helper to resolve user string (ID, mention, or username) to User object (synchronous - cache only)
  const resolveUserSync = userValue => {
    if (!userValue) return null;
    // If already a User object, return it
    if (userValue && typeof userValue === "object" && userValue.id) {
      return userValue;
    }
    // If string, try to resolve from cache
    if (typeof userValue === "string") {
      // Extract user ID from mention format: <@123456789> or <@!123456789>
      const mentionMatch = userValue.match(/<@!?(\d+)>/);
      const userId = mentionMatch ? mentionMatch[1] : userValue;

      // Try to get from cache first
      if (client && client.users.cache.has(userId)) {
        return client.users.cache.get(userId);
      }

      // Try to get from guild member cache
      if (guild) {
        const member = guild.members.cache.get(userId);
        if (member) {
          return member.user;
        }
      }
    }
    return null;
  };

  // Helper to convert value to appropriate type and format
  const convertOptionValue = (name, value) => {
    // Handle arrays - convert to string for commands that expect strings
    if (Array.isArray(value)) {
      // Special handling for role-reactions roles option
      if (name === "roles" && commandName === "role-reactions") {
        // Convert array of role names to emoji:role format
        // If array has single role, use default emoji
        if (value.length === 1) {
          return `✅:${value[0]}`;
        }
        // If multiple roles, use numbered emojis
        const emojis = [
          "1️⃣",
          "2️⃣",
          "3️⃣",
          "4️⃣",
          "5️⃣",
          "6️⃣",
          "7️⃣",
          "8️⃣",
          "9️⃣",
          "🔟",
        ];
        return value
          .map((role, idx) => `${emojis[idx] || "✅"}:${role}`)
          .join(", ");
      }
      // For other arrays, join with commas
      return value.join(", ");
    }
    // Convert other types to string if needed
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  };

  if (subcommand) {
    optionsArray.push({
      name: subcommand,
      type: 1, // Subcommand type
      options: Object.entries(options).map(([name, value]) => ({
        name,
        type: 3, // Always string type (Discord.js will handle conversion)
        value: convertOptionValue(name, value),
      })),
    });
  } else {
    // Direct options (no subcommand)
    optionsArray.push(
      ...Object.entries(options).map(([name, value]) => ({
        name,
        type: 3, // Always string type
        value: convertOptionValue(name, value),
      })),
    );
  }

  // Create a minimal mock interaction
  // We'll use the actual ChatInputCommandInteraction but with our data
  const interaction = {
    id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 2, // ApplicationCommand
    commandName,
    commandType: 1, // ChatInput
    applicationId: client?.user?.id || null,
    user,
    member: guild?.members.cache.get(user.id) || null,
    guild,
    channel,
    client,
    guildId: guild?.id || null,
    channelId: channel?.id || null,
    createdTimestamp: Date.now(),
    replied: false,
    deferred: false,
    _handled: false,
    // Additional properties that commands might check
    isCommand: () => true,
    isContextMenuCommand: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    options: {
      getSubcommand: () => subcommand,
      getString: name => {
        const value = options[name];
        // Special handling for role-reactions roles option
        if (
          name === "roles" &&
          commandName === "role-reactions" &&
          Array.isArray(value)
        ) {
          // Convert array of role names to emoji:role format
          const emojis = [
            "✅",
            "🎮",
            "🎨",
            "💻",
            "📚",
            "🎵",
            "🎬",
            "⚽",
            "🏀",
            "🎯",
          ];
          return value
            .map((role, idx) => `${emojis[idx] || "✅"}:${role}`)
            .join(", ");
        }
        // Convert arrays to comma-separated strings (for other cases)
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        // Convert other types to string
        if (value !== undefined && value !== null) {
          return String(value);
        }
        return value;
      },
      getInteger: name => options[name],
      getNumber: name => options[name], // For numeric options
      getBoolean: name => options[name],
      getUser: name => {
        const value = options[name];
        // Resolve user string to User object if needed (from cache only)
        if (value && typeof value === "string") {
          return resolveUserSync(value);
        }
        // If already a User object, return it
        return value;
      },
      getRole: name => options[name],
      getChannel: name => options[name],
      getAttachment: name => options[name], // For file attachments
      getFocused: () => "", // For autocomplete (not used in programmatic execution)
    },
    // Mock reply methods - actually send to channel
    async reply(content) {
      this.replied = true;
      // Actually send the message to the channel
      if (channel && typeof channel.send === "function") {
        return await channel.send(content);
      }
      return { id: `mock_reply_${Date.now()}` };
    },
    async deferReply(_options) {
      this.deferred = true;
      // For deferred replies, we'll send when editReply is called
      return { id: `mock_defer_${Date.now()}` };
    },
    async editReply(content) {
      // Actually send the message to the channel (since we "deferred")
      if (channel && typeof channel.send === "function") {
        return await channel.send(content);
      }
      return { id: `mock_edit_${Date.now()}` };
    },
    async followUp(content) {
      // Actually send follow-up message to the channel
      if (channel && typeof channel.send === "function") {
        return await channel.send(content);
      }
      return { id: `mock_followup_${Date.now()}` };
    },
    isRepliable: () => true,
    isChatInputCommand: () => true,
  };

  // Make it look like a real ChatInputCommandInteraction
  Object.setPrototypeOf(interaction, ChatInputCommandInteraction.prototype);

  return interaction;
}

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
  // Check if command is allowed (only general commands)
  const isAllowed = await canExecuteCommand(commandName, subcommand, client);
  if (!isAllowed) {
    const generalCommands = await getGeneralCommands();
    throw new Error(
      `Command "${commandName}" is not allowed. AI can only execute general commands for safety. Available general commands: ${generalCommands.join(", ")}. If you need to use "${commandName}", it's likely an admin or developer command that must be run manually by a user.`,
    );
  }

  // Get command config for subcommand validation
  const ALLOWED_COMMANDS = await getAllowedCommands(client);
  const commandConfig = ALLOWED_COMMANDS[commandName];

  // Check subcommand if provided
  if (subcommand && commandConfig?.subcommands) {
    // Handle subcommand groups (e.g., "group subcommand")
    const normalizedSubcommand = subcommand.replace(/\s+/g, " ");
    if (
      !commandConfig.subcommands.includes(subcommand) &&
      !commandConfig.subcommands.includes(normalizedSubcommand)
    ) {
      const validSubcommands = commandConfig.subcommands.join(", ");
      throw new Error(
        `Subcommand "${subcommand}" is not valid for command "${commandName}". Valid subcommands are: ${validSubcommands}. If no subcommands are listed, this command doesn't use subcommands - remove the "subcommand" field from your action.`,
      );
    }
  } else if (subcommand && !commandConfig?.subcommands) {
    // Command doesn't have subcommands but one was provided
    throw new Error(
      `Command "${commandName}" does not have subcommands. Remove the "subcommand" field from your action and use only "command" and "options".`,
    );
  }

  try {
    // Resolve user options before creating interaction (for async resolution)
    const resolvedOptions = { ...options };
    let executorUser = user; // Default: requester executes the command

    for (const [key, value] of Object.entries(options)) {
      // Check if this is a user option by checking command structure
      // For RPS, "user" is a user option (no subcommands anymore)
      if (key === "user" && commandName === "rps") {
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
      commandName,
      subcommand,
      options: resolvedOptions,
      user: executorUser, // Use bot if challenging requester, otherwise requester
      guild,
      channel,
      client,
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
      command: commandName,
      subcommand,
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

/**
 * Check if a command can be executed by the AI
 * Only general commands are allowed
 * @param {string} commandName - Command name
 * @param {string} subcommand - Optional subcommand
 * @param {import('discord.js').Client} client - Discord client (optional)
 * @returns {Promise<boolean>} True if command can be executed
 */
export async function canExecuteCommand(
  commandName,
  subcommand = null,
  client = null,
) {
  // Fast path: use sync version for immediate check (uses cache if available)
  const generalCommands = getGeneralCommandsSync();

  // Only allow general commands
  if (!generalCommands.includes(commandName)) {
    logger.warn(
      `AI attempted to execute non-general command: ${commandName} (blocked)`,
    );
    return false;
  }

  // Get command config (cached after first call)
  const ALLOWED_COMMANDS = await getAllowedCommands(client);
  const commandConfig = ALLOWED_COMMANDS[commandName];

  if (!commandConfig || !commandConfig.allowed) {
    return false;
  }

  // Validate subcommand if provided
  if (subcommand && commandConfig.subcommands) {
    const normalizedSubcommand = subcommand.replace(/\s+/g, " ");
    return (
      commandConfig.subcommands.includes(subcommand) ||
      commandConfig.subcommands.includes(normalizedSubcommand)
    );
  }

  return true;
}

/**
 * Get list of commands the AI can execute
 * Only returns general commands for safety
 * @param {import('discord.js').Client} client - Discord client (optional, for dynamic discovery)
 * @returns {Promise<Array>} List of executable commands with descriptions
 */
export async function getExecutableCommands(client = null) {
  // Parallelize async operations for better performance
  const [generalCommands, ALLOWED_COMMANDS] = await Promise.all([
    getGeneralCommands(),
    getAllowedCommands(client),
  ]);

  // Filter to only general commands (double-check for safety)
  // Note: getAllowedCommands already filters to general commands, but we verify again
  return Object.entries(ALLOWED_COMMANDS)
    .filter(([name]) => generalCommands.includes(name))
    .filter(([, config]) => config.allowed)
    .map(([name, config]) => ({
      name,
      description: config.description,
      subcommands: config.subcommands || null,
    }));
}
