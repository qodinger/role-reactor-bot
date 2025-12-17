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
      getUser: name => options[name],
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
    throw new Error(
      `Command "${commandName}" is not allowed. AI can only execute general commands for safety.`,
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
      throw new Error(
        `Subcommand "${subcommand}" is not allowed for command "${commandName}".`,
      );
    }
  }

  try {
    // Create mock interaction
    const interaction = createMockInteraction({
      commandName,
      subcommand,
      options,
      user,
      guild,
      channel,
      client,
    });

    // Execute the command - it will send its own response directly to the channel
    const commandHandler = getCommandHandler();
    await commandHandler.executeCommand(interaction, client);

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
    throw error;
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
