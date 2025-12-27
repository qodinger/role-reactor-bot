import { THEME, EMOJIS } from "../../../config/theme.js";
import { getLogger } from "../../../utils/logger.js";
import { commandRegistry } from "../../../utils/core/commandRegistry.js";

// ============================================================================
// TAG GENERATION
// ============================================================================

/**
 * Generate tags for commands using registry keywords
 * Tags are generated from command metadata keywords, which are the single source of truth
 * @param {string} commandName - The command name
 * @param {import('discord.js').Client} [client] - Discord client (optional, for registry access)
 * @returns {Promise<string[]>} Array of relevant tags
 */
export async function generateCommandTags(commandName, client = null) {
  const tags = [commandName]; // Always include command name as a tag

  // Get keywords from registry (from command metadata)
  if (client) {
    try {
      await commandRegistry.initialize(client);
      const keywords = commandRegistry.getCommandKeywords(commandName);
      if (keywords && keywords.length > 0) {
        // Add keywords as tags (they're already relevant search terms)
        tags.push(...keywords);
      }
    } catch (error) {
      const logger = getLogger();
      logger.debug(
        `Failed to get keywords from registry for ${commandName}:`,
        error,
      );
    }
  }

  return [...new Set(tags)]; // Remove duplicates
}

// ============================================================================
// EMOJI RETRIEVAL
// ============================================================================

/**
 * Get appropriate emoji for a command from registry metadata
 * All commands should have emojis defined in their metadata
 * @param {string} commandName - The command name
 * @param {import('discord.js').Client} [client] - Discord client (optional, for registry initialization)
 * @returns {Promise<string>} Appropriate emoji for the command
 */
export async function getCommandEmoji(commandName, client = null) {
  // Get emoji from command metadata (registry)
  if (client) {
    try {
      await commandRegistry.initialize(client);
      const metadata = commandRegistry.getCommandMetadata(commandName);
      if (metadata?.emoji) {
        return metadata.emoji;
      }
    } catch (error) {
      const logger = getLogger();
      logger.debug(
        `Failed to get emoji from registry for ${commandName}:`,
        error,
      );
    }
  }

  // Fallback to default emoji if registry not available or emoji not found
  return EMOJIS.ACTIONS.HELP;
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

/**
 * Valid category keys
 */
const CATEGORY_KEYS = ["general", "admin", "developer"];

/**
 * Get category display configuration
 * Commands are automatically discovered from the registry based on their metadata.category
 * This function returns UI configuration for categories (emoji, name, description, color, permissions)
 * @param {string} categoryKey - Category key ("general", "admin", or "developer")
 * @returns {Object|null} Category configuration or null if not found
 */
function getCategoryConfig(categoryKey) {
  const configs = {
    developer: {
      emoji: EMOJIS.CATEGORIES.DEVELOPER,
      name: "Developer",
      description: "Developer tools, bot management, and debugging commands",
      color: THEME.DEVELOPER,
      requiredPermissions: ["DEVELOPER"],
    },
    admin: {
      emoji: EMOJIS.CATEGORIES.ADMIN,
      name: "Administration",
      description:
        "Manage role reactions, temporary roles, moderation, and server settings",
      color: THEME.ADMIN,
      requiredPermissions: ["MANAGE_ROLES"],
    },
    general: {
      emoji: EMOJIS.CATEGORIES.GENERAL,
      name: "General",
      description:
        "Basic bot information, avatar generation, and community features",
      color: THEME.GENERAL,
      requiredPermissions: [],
    },
  };

  return configs[categoryKey] || null;
}

// ============================================================================
// METADATA GENERATION
// ============================================================================

/**
 * Generate command metadata for help system
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Promise<Object>} Generated command metadata
 */
export async function generateCommandMetadata(client) {
  const metadata = {};

  // Initialize command registry
  if (client) {
    await commandRegistry.initialize(client);
  } else {
    const logger = getLogger();
    logger.warn("Client not available, returning empty metadata");
    return {};
  }

  // Get all commands from registry
  const allCommandNames = commandRegistry.getAllCommandNames();

  for (const commandName of allCommandNames) {
    // Get description from registry (preferred) or fallback
    const description =
      commandRegistry.getCommandDescription(commandName) ||
      "No description available";
    const shortDesc =
      description.length > 50
        ? `${description.substring(0, 47)}...`
        : description;

    // Get emoji from registry (metadata)
    const emoji = await getCommandEmoji(commandName, client);

    // Generate tags using registry keywords (from metadata)
    const tags = await generateCommandTags(commandName, client);

    metadata[commandName] = {
      emoji,
      shortDesc,
      tags,
    };
  }

  return metadata;
}

/**
 * Generate command categories based on loaded commands using registry
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Promise<Object>} Generated command categories
 */
export async function generateCommandCategories(client) {
  const categories = {};

  // Initialize command registry
  if (client) {
    await commandRegistry.initialize(client);
  } else {
    const logger = getLogger();
    logger.warn("Client not available, using fallback categories");
    const fallbackCategories = {};
    for (const categoryKey of CATEGORY_KEYS) {
      const config = getCategoryConfig(categoryKey);
      if (config) {
        fallbackCategories[categoryKey] = {
          ...config,
          commands: [],
        };
      }
    }
    return fallbackCategories;
  }

  // Get commands by category from registry
  for (const categoryKey of CATEGORY_KEYS) {
    const commandsInCategory =
      commandRegistry.getCommandsByCategory(categoryKey);
    const commandNames = commandsInCategory.map(cmd => cmd.name);

    // Get base config for this category
    const baseConfig = getCategoryConfig(categoryKey);
    if (!baseConfig) {
      const logger = getLogger();
      logger.warn(`No config found for category: ${categoryKey}`);
      continue;
    }

    // Only add category if it has commands
    if (commandNames.length > 0) {
      categories[categoryKey] = {
        ...baseConfig,
        commands: commandNames,
      };
    }
  }

  return categories;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Get complete dynamic help data for the help system
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Promise<Object>} Complete help data with metadata and categories
 */
export async function getDynamicHelpData(client) {
  if (!client) {
    const logger = getLogger();
    logger.warn("Client not available, using fallback help data");
    return {
      COMMAND_METADATA: {},
      COMMAND_CATEGORIES: await generateCommandCategories(null),
    };
  }

  return {
    COMMAND_METADATA: await generateCommandMetadata(client),
    COMMAND_CATEGORIES: await generateCommandCategories(client),
  };
}
