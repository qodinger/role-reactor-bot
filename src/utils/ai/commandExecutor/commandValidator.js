import { getLogger } from "../../logger.js";
import {
  getGeneralCommands,
  getGeneralCommandsSync,
  getAllowedCommands,
} from "./commandDiscovery.js";

const logger = getLogger();

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
  // Block recursive ask command execution to prevent infinite loops
  if (commandName === "ask") {
    logger.warn(
      `AI attempted to execute ask command recursively (blocked to prevent infinite loops)`,
    );
    return false;
  }

  // Parse command name - handle cases where AI puts "command subcommand" in commandName
  // e.g., "poll create" should become commandName="poll", subcommand="create"
  let parsedCommandName = commandName;
  let parsedSubcommand = subcommand;

  if (commandName.includes(" ") && !subcommand) {
    const parts = commandName.split(" ");
    parsedCommandName = parts[0];
    parsedSubcommand = parts.slice(1).join(" ");
    logger.debug(
      `[canExecuteCommand] Parsed command "${commandName}" into command="${parsedCommandName}", subcommand="${parsedSubcommand}"`,
    );
  }

  // Check if command is in general commands list (synchronous check first for speed)
  const generalCommands = getGeneralCommandsSync();
  if (!generalCommands.includes(parsedCommandName)) {
    // Double-check with async discovery (in case cache wasn't populated yet)
    const asyncGeneralCommands = await getGeneralCommands();
    if (!asyncGeneralCommands.includes(parsedCommandName)) {
      return false;
    }
  }

  // Get command config to check subcommand validity
  const ALLOWED_COMMANDS = await getAllowedCommands(client);
  const commandConfig = ALLOWED_COMMANDS[parsedCommandName];

  if (!commandConfig || !commandConfig.allowed) {
    return false;
  }

  // If subcommand provided, validate it exists for this command
  if (parsedSubcommand && commandConfig.subcommands) {
    const normalizedSubcommand = parsedSubcommand.replace(/\s+/g, " ");
    if (
      !commandConfig.subcommands.includes(parsedSubcommand) &&
      !commandConfig.subcommands.includes(normalizedSubcommand)
    ) {
      return false;
    }
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
  return Object.entries(ALLOWED_COMMANDS)
    .filter(([name]) => generalCommands.includes(name))
    .filter(([, config]) => config.allowed)
    .map(([name, config]) => ({
      name,
      description: config.description,
      subcommands: config.subcommands || null,
    }));
}
