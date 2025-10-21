import { THEME, EMOJIS } from "../../../config/theme.js";
import { getCommandHandler } from "../../../utils/core/commandHandler.js";
import { getLogger } from "../../../utils/logger.js";

// ============================================================================
// TAG GENERATION
// ============================================================================

/**
 * Tag patterns for command categorization
 */
const TAG_PATTERNS = {
  role: ["role", "roles"],
  temporary: ["temp", "temporary"],
  welcome: ["welcome"],
  goodbye: ["goodbye"],
  setup: ["setup", "configure"],
  view: ["list", "view"],
  edit: ["update", "edit"],
  delete: ["delete", "remove"],
  assign: ["assign", "give"],
  experience: ["level", "xp", "experience"],
  ranking: ["leaderboard", "ranking"],
  image: ["avatar", "image"],
  help: ["help", "guide"],
  status: ["ping", "latency"],
  health: ["health", "status"],
  performance: ["performance", "metrics"],
  storage: ["storage", "database"],
  link: ["invite", "link"],
  support: ["support", "community", "sponsor", "donate"],
  fun: ["8ball", "question"],
  webhook: ["webhook", "api", "kofi", "donation"],
  debug: ["debug", "verify"],
};

/**
 * Generate smart tags for commands based on name and description
 * @param {string} commandName - The command name
 * @param {string} description - The command description
 * @returns {string[]} Array of relevant tags
 */
export function generateCommandTags(commandName, description) {
  const tags = [commandName];
  const text = `${commandName} ${description}`.toLowerCase();

  // Add tags based on patterns
  for (const [tag, patterns] of Object.entries(TAG_PATTERNS)) {
    if (patterns.some(pattern => text.includes(pattern))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

// ============================================================================
// EMOJI MAPPING
// ============================================================================

/**
 * Emoji mapping for command types
 */
const EMOJI_MAP = {
  // Experience system
  level: EMOJIS.FEATURES.EXPERIENCE,
  leaderboard: EMOJIS.FEATURES.EXPERIENCE,
  xp: EMOJIS.FEATURES.EXPERIENCE,

  // Fun commands
  "8ball": EMOJIS.UI.QUESTION,

  // Role management
  role: EMOJIS.FEATURES.ROLES,
  roles: EMOJIS.FEATURES.ROLES,
  welcome: EMOJIS.ACTIONS.SETTINGS,
  goodbye: EMOJIS.ACTIONS.SETTINGS,

  // Temporary roles
  temp: EMOJIS.FEATURES.TEMPORARY,
  temporary: EMOJIS.FEATURES.TEMPORARY,

  // Actions
  setup: EMOJIS.ACTIONS.SETTINGS,
  list: EMOJIS.ACTIONS.VIEW,
  update: EMOJIS.ACTIONS.EDIT,
  delete: EMOJIS.ACTIONS.DELETE,
  assign: EMOJIS.ACTIONS.ADD,
  remove: EMOJIS.ACTIONS.REMOVE,

  // System monitoring
  health: EMOJIS.STATUS.SUCCESS,
  performance: EMOJIS.FEATURES.MONITORING,
  storage: EMOJIS.FEATURES.BACKUP,

  // Community
  sponsor: EMOJIS.ACTIONS.HEART,

  // Webhook and API
  webhook: EMOJIS.FEATURES.MONITORING,
  api: EMOJIS.FEATURES.MONITORING,
  kofi: EMOJIS.ACTIONS.HEART,

  // Debug and verification
  debug: EMOJIS.UI.INFO,
  verify: EMOJIS.STATUS.SUCCESS,

  // Default fallback
  default: EMOJIS.ACTIONS.HELP,
};

/**
 * Get appropriate emoji for a command based on its name
 * @param {string} commandName - The command name
 * @returns {string} Appropriate emoji for the command
 */
export function getCommandEmoji(commandName) {
  for (const [pattern, emoji] of Object.entries(EMOJI_MAP)) {
    if (commandName.includes(pattern)) {
      return emoji;
    }
  }
  return EMOJI_MAP.default;
}

// ============================================================================
// COMMAND CATEGORIES
// ============================================================================

/**
 * Command category definitions with automatic command discovery
 */
export const COMMAND_CATEGORIES = {
  developer: {
    emoji: EMOJIS.CATEGORIES.DEVELOPER,
    name: "Developer",
    description: "Developer tools, bot management, and debugging commands",
    color: THEME.DEVELOPER,
    requiredPermissions: ["DEVELOPER"],
    commandPatterns: [
      "health",
      "performance",
      "storage",
      "core-management",
      "verify",
    ],
  },
  admin: {
    emoji: EMOJIS.CATEGORIES.ADMIN,
    name: "Administration",
    description: "Manage role reactions, temporary roles, and server settings",
    color: THEME.ADMIN,
    requiredPermissions: ["MANAGE_ROLES"],
    commandPatterns: [
      "role-reactions",
      "temp-roles",
      "welcome",
      "goodbye",
      "xp",
    ],
  },
  general: {
    emoji: EMOJIS.CATEGORIES.GENERAL,
    name: "General",
    description:
      "Basic bot information, avatar generation, and community features",
    color: THEME.GENERAL,
    requiredPermissions: [],
    commandPatterns: [
      "help",
      "ping",
      "invite",
      "support",
      "sponsor",
      "avatar",
      "8ball",
      "level",
      "leaderboard",
      "core",
      "poll",
    ],
  },
};

// ============================================================================
// METADATA GENERATION
// ============================================================================

/**
 * Generate command metadata for help system
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Object} Generated command metadata
 */
export function generateCommandMetadata(client) {
  const commandHandler = getCommandHandler();
  const allCommands = commandHandler.getAllCommands();
  const metadata = {};

  // Safety check for client and commands collection
  if (!client?.commands) {
    const logger = getLogger();
    logger.warn(
      "Client or commands collection not available, returning empty metadata",
    );
    return {};
  }

  for (const commandName of allCommands) {
    const command = client.commands.get(commandName);
    if (!command) continue;

    const description = command.data?.description || "No description available";
    const shortDesc =
      description.length > 50
        ? `${description.substring(0, 47)}...`
        : description;

    metadata[commandName] = {
      emoji: getCommandEmoji(commandName),
      shortDesc,
      tags: generateCommandTags(commandName, description),
    };
  }

  return metadata;
}

/**
 * Generate command categories based on loaded commands
 * @param {import('discord.js').Client} _client - Discord client instance (unused but kept for API consistency)
 * @returns {Object} Generated command categories
 */
export function generateCommandCategories(_client) {
  const commandHandler = getCommandHandler();
  const allCommands = commandHandler.getAllCommands();
  const categories = {};

  // Safety check for command handler
  if (!commandHandler?.getAllCommands || !allCommands?.length) {
    const logger = getLogger();
    logger.warn(
      "Command handler not available or no commands found, using fallback categories",
    );
    const fallbackCategories = {};
    for (const [key, config] of Object.entries(COMMAND_CATEGORIES)) {
      fallbackCategories[key] = {
        ...config,
        commands: [],
      };
    }
    return fallbackCategories;
  }

  // Initialize categories with base configuration
  for (const [key, config] of Object.entries(COMMAND_CATEGORIES)) {
    categories[key] = { ...config, commands: [] };
  }

  // Categorize commands based on patterns
  for (const commandName of allCommands) {
    let categorized = false;

    for (const [categoryKey, categoryConfig] of Object.entries(categories)) {
      const patterns = categoryConfig.commandPatterns;

      if (
        patterns.some(
          pattern => commandName.includes(pattern) || commandName === pattern,
        )
      ) {
        categories[categoryKey].commands.push(commandName);
        categorized = true;
        break;
      }
    }

    // Fallback to general category
    if (!categorized) {
      if (!categories.general) {
        categories.general = {
          emoji: EMOJIS.CATEGORIES.GENERAL,
          name: "General",
          description: "Basic bot information and help",
          color: THEME.GENERAL,
          requiredPermissions: [],
          commands: [],
        };
      }
      categories.general.commands.push(commandName);
    }
  }

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categories).filter(
      ([, config]) => config.commands.length > 0,
    ),
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Get complete dynamic help data for the help system
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Object} Complete help data with metadata and categories
 */
export function getDynamicHelpData(client) {
  if (!client) {
    const logger = getLogger();
    logger.warn("Client not available, using fallback help data");
    return {
      COMMAND_METADATA: {},
      COMMAND_CATEGORIES: generateCommandCategories(null),
    };
  }

  return {
    COMMAND_METADATA: generateCommandMetadata(client),
    COMMAND_CATEGORIES: generateCommandCategories(client),
  };
}
