import { getLogger } from "../../logger.js";
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
    const generalCommandsPath = path.join(
      __dirname,
      "../../../commands/general",
    );

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
    const adminCommandsPath = path.join(__dirname, "../../../commands/admin");
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
      "../../../commands/developer",
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
export async function getAllowedCommands(client = null) {
  return await buildAllowedCommands(client);
}
