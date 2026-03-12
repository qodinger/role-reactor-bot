import { getLogger } from "../../logger.js";
import { getAllowedCommands } from "./commandDiscovery.js";
import {
  AI_ADMIN_COMMAND_BLOCKLIST,
  AI_DEFAULT_ADMIN_BLOCKLIST,
} from "../constants.js";

const logger = getLogger();

/**
 * Get the effective blocklist (env override + defaults)
 * @returns {string[]} List of command names the AI must never execute
 */
function getEffectiveBlocklist() {
  return AI_ADMIN_COMMAND_BLOCKLIST.length > 0
    ? AI_ADMIN_COMMAND_BLOCKLIST
    : AI_DEFAULT_ADMIN_BLOCKLIST;
}

/**
 * Check if a command can be executed by the AI
 * General commands are always allowed; admin commands require user permission
 * @param {string} commandName - Command name
 * @param {string} subcommand - Optional subcommand
 * @param {import('discord.js').Client} client - Discord client (optional)
 * @param {import('discord.js').User} user - User requesting command
 * @param {import('discord.js').Guild} guild - Context guild
 * @returns {Promise<boolean>} True if command can be executed
 */
export async function canExecuteCommand(
  commandName,
  subcommand = null,
  client = null,
  user = null,
  guild = null,
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

  // Get command config to check validity
  const ALLOWED_COMMANDS = await getAllowedCommands(client);
  const commandConfig = ALLOWED_COMMANDS[parsedCommandName];

  if (!commandConfig || !commandConfig.allowed) {
    return false;
  }

  // Check blocklist - these commands are NEVER allowed for AI execution
  const blocklist = getEffectiveBlocklist();
  if (blocklist.includes(parsedCommandName)) {
    logger.warn(
      `[canExecuteCommand] Command "${parsedCommandName}" is on the AI blocklist and cannot be executed.`,
    );
    return false;
  }

  // Check admin/mod permissions
  let isAdmin = false;
  if (user && guild) {
    try {
      const member =
        guild.members.cache.get(user.id) ||
        (await guild.members.fetch(user.id).catch(() => null));
      if (member) {
        isAdmin =
          member.permissions.has("Administrator") ||
          member.permissions.has("ManageGuild");
      }
    } catch (e) {}
  }

  // Validation based on roles
  if (commandConfig.isAdmin && !isAdmin) {
    logger.warn(
      `User ${user?.id} attempted admin command ${commandName} without permission.`,
    );
    return false;
  }
  // Must be either general or a validated admin command
  if (!commandConfig.isGeneral && !commandConfig.isAdmin) {
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
 * Only returns general commands, or additionally admin commands if user is admin
 * @param {import('discord.js').Client} client - Discord client (optional, for dynamic discovery)
 * @param {import('discord.js').User} user - Discord user
 * @param {import('discord.js').Guild} guild - Discord guild
 * @returns {Promise<Array>} List of executable commands with descriptions
 */
export async function getExecutableCommands(
  client = null,
  user = null,
  guild = null,
) {
  // Parallelize async operations for better performance
  const ALLOWED_COMMANDS = await getAllowedCommands(client);

  // Check admin/mod permissions
  let isAdmin = false;
  if (user && guild) {
    try {
      const member =
        guild.members.cache.get(user.id) ||
        (await guild.members.fetch(user.id).catch(() => null));
      if (member) {
        isAdmin =
          member.permissions.has("Administrator") ||
          member.permissions.has("ManageGuild");
      }
    } catch (e) {}
  }

  const blocklist = getEffectiveBlocklist();

  return Object.entries(ALLOWED_COMMANDS)
    .filter(([name]) => !blocklist.includes(name))
    .filter(([, config]) => config.allowed)
    .filter(([, config]) => config.isGeneral || (config.isAdmin && isAdmin))
    .map(([name, config]) => ({
      name,
      description: config.description,
      subcommands: config.subcommands || null,
    }));
}
