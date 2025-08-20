import { THEME, EMOJIS } from "../../../config/theme.js";
import { getCommandHandler } from "../../../utils/core/commandHandler.js";

/**
 * Automatically generate smart tags for commands based on name and description
 * @param {string} commandName - The command name
 * @param {string} description - The command description
 * @returns {Array} - Array of relevant tags
 */
export function generateCommandTags(commandName, description) {
  const tags = [commandName];
  const text = `${commandName} ${description}`.toLowerCase();

  // Add tags based on command patterns
  if (text.includes("role") || text.includes("roles")) tags.push("role");
  if (text.includes("temp") || text.includes("temporary"))
    tags.push("temporary");
  if (text.includes("welcome")) tags.push("welcome");
  if (text.includes("setup") || text.includes("configure")) tags.push("setup");
  if (text.includes("list") || text.includes("view")) tags.push("view");
  if (text.includes("update") || text.includes("edit")) tags.push("edit");
  if (text.includes("delete") || text.includes("remove")) tags.push("delete");
  if (text.includes("assign") || text.includes("give")) tags.push("assign");
  if (
    text.includes("level") ||
    text.includes("xp") ||
    text.includes("experience")
  )
    tags.push("experience");
  if (text.includes("leaderboard") || text.includes("ranking"))
    tags.push("ranking");
  if (text.includes("info") || text.includes("information")) tags.push("info");
  if (text.includes("avatar") || text.includes("image")) tags.push("image");
  if (text.includes("help") || text.includes("guide")) tags.push("help");
  if (text.includes("ping") || text.includes("latency")) tags.push("status");
  if (text.includes("health") || text.includes("status")) tags.push("health");
  if (text.includes("performance") || text.includes("metrics"))
    tags.push("performance");
  if (text.includes("storage") || text.includes("database"))
    tags.push("storage");
  if (text.includes("invite") || text.includes("link")) tags.push("link");
  if (text.includes("support") || text.includes("community"))
    tags.push("support");
  if (
    text.includes("fun") ||
    text.includes("8ball") ||
    text.includes("question")
  )
    tags.push("fun");

  // Remove duplicates and return
  return [...new Set(tags)];
}

/**
 * Automatically determine command complexity based on name and patterns
 * @param {string} commandName - The command name
 * @param {string} description - The command description
 * @returns {string} - Complexity level
 */
export function getCommandComplexity(commandName, description) {
  const complexity = description?.toLowerCase() || "";

  // Check for complexity indicators in description
  if (
    complexity.includes("complex") ||
    complexity.includes("advanced") ||
    complexity.includes("expert")
  ) {
    return "Hard";
  }

  if (complexity.includes("medium") || complexity.includes("moderate")) {
    return "Medium";
  }

  // Check command name patterns
  if (
    commandName.includes("setup") ||
    commandName.includes("configure") ||
    commandName.includes("manage")
  ) {
    return "Medium";
  }

  if (
    commandName.includes("list") ||
    commandName.includes("view") ||
    commandName.includes("info")
  ) {
    return "Easy";
  }

  return "Easy"; // Default to easy
}

/**
 * Automatically determine command usage frequency based on name and patterns
 * @param {string} commandName - The command name
 * @param {string} description - The command description
 * @returns {string} - Usage frequency
 */
export function getCommandUsage(commandName, description) {
  const usage = description?.toLowerCase() || "";

  // Check for usage indicators in description
  if (
    usage.includes("frequently") ||
    usage.includes("often") ||
    usage.includes("daily")
  ) {
    return "High";
  }

  if (usage.includes("occasionally") || usage.includes("sometimes")) {
    return "Medium";
  }

  if (usage.includes("rarely") || usage.includes("seldom")) {
    return "Low";
  }

  // Check command name patterns
  if (
    commandName.includes("help") ||
    commandName.includes("ping") ||
    commandName.includes("info")
  ) {
    return "High";
  }

  if (
    commandName.includes("setup") ||
    commandName.includes("configure") ||
    commandName.includes("admin")
  ) {
    return "Medium";
  }

  if (
    commandName.includes("debug") ||
    commandName.includes("dev") ||
    commandName.includes("health")
  ) {
    return "Low";
  }

  return "Medium"; // Default to medium
}

/**
 * Get appropriate emoji for a command based on its name
 * @param {string} commandName - The command name
 * @returns {string} - Appropriate emoji for the command
 */
export function getCommandEmoji(commandName) {
  // Smart emoji mapping based on command patterns
  const emojiMap = {
    // Experience commands
    level: EMOJIS.FEATURES.EXPERIENCE,
    leaderboard: EMOJIS.FEATURES.EXPERIENCE,
    xp: EMOJIS.FEATURES.EXPERIENCE,

    // Info commands
    serverinfo: EMOJIS.UI.SERVER,
    userinfo: EMOJIS.UI.USER,
    info: EMOJIS.UI.INFO,

    // Fun commands
    "8ball": EMOJIS.UI.QUESTION,
    fun: EMOJIS.CATEGORIES.FUN,

    // Role commands
    role: EMOJIS.FEATURES.ROLES,
    roles: EMOJIS.FEATURES.ROLES,

    // Welcome commands
    welcome: EMOJIS.ACTIONS.SETTINGS,

    // Temporary commands
    temp: EMOJIS.FEATURES.TEMPORARY,
    temporary: EMOJIS.FEATURES.TEMPORARY,

    // Setup commands
    setup: EMOJIS.ACTIONS.SETTINGS,

    // List commands
    list: EMOJIS.ACTIONS.VIEW,

    // Update commands
    update: EMOJIS.ACTIONS.EDIT,

    // Delete commands
    delete: EMOJIS.ACTIONS.DELETE,

    // Assign commands
    assign: EMOJIS.ACTIONS.ADD,

    // Remove commands
    remove: EMOJIS.ACTIONS.REMOVE,

    // Health commands
    health: EMOJIS.STATUS.SUCCESS,

    // Performance commands
    performance: EMOJIS.FEATURES.MONITORING,

    // Storage commands
    storage: EMOJIS.FEATURES.BACKUP,

    // Default fallback
    default: EMOJIS.ACTIONS.HELP,
  };

  // Check for pattern matches first
  for (const [pattern, emoji] of Object.entries(emojiMap)) {
    if (commandName.includes(pattern)) {
      return emoji;
    }
  }

  return emojiMap.default;
}

/**
 * Command category definitions with automatic command discovery
 */
export const COMMAND_CATEGORIES = {
  admin: {
    emoji: EMOJIS.CATEGORIES.ADMIN,
    name: "Administration",
    description: "Manage role reactions and server settings",
    color: THEME.ADMIN,
    requiredPermissions: ["MANAGE_ROLES"],
    commandPatterns: [
      "setup-",
      "update-",
      "delete-",
      "list-",
      "assign-",
      "remove-",
      "welcome-",
      "role",
      "temp",
      "manage",
      "admin",
      "xp",
    ],
  },
  general: {
    emoji: EMOJIS.CATEGORIES.GENERAL,
    name: "General",
    description: "Basic bot information and help",
    color: THEME.GENERAL,
    requiredPermissions: [],
    commandPatterns: [
      "help",
      "ping",
      "invite",
      "support",
      "serverinfo",
      "userinfo",
      "avatar",
      "8ball",
      "level",
      "leaderboard",
      "info",
      "fun",
      "xp",
    ],
  },
  developer: {
    emoji: EMOJIS.CATEGORIES.DEVELOPER,
    name: "Developer",
    description: "Developer and bot management commands",
    color: THEME.DEVELOPER,
    requiredPermissions: ["DEVELOPER"],
    commandPatterns: ["health", "performance", "storage", "debug", "dev"],
  },
};

/**
 * Dynamically generate command metadata based on loaded commands
 * @param {Client} client - Discord client instance
 * @returns {Object} Generated command metadata
 */
export function generateCommandMetadata(client) {
  const commandHandler = getCommandHandler();
  const allCommands = commandHandler.getAllCommands();
  const metadata = {};

  // Safety check for client and commands collection
  if (!client || !client.commands) {
    console.warn(
      "Client or commands collection not available, returning empty metadata",
    );
    return {};
  }

  for (const commandName of allCommands) {
    const command = client.commands.get(commandName);
    if (!command) continue;

    // Always generate metadata dynamically, but enhance with pre-defined data if available
    const description = command.data?.description || "No description available";
    const shortDesc =
      description.length > 50
        ? `${description.substring(0, 47)}...`
        : description;

    // Generate smart tags based on command name and description
    const tags = generateCommandTags(commandName, description);

    // Start with dynamic metadata
    metadata[commandName] = {
      emoji: getCommandEmoji(commandName),
      complexity: getCommandComplexity(commandName, description),
      usage: getCommandUsage(commandName, description),
      shortDesc,
      tags,
    };
  }

  return metadata;
}

/**
 * Dynamically generate command categories based on loaded commands
 * @param {Client} _client - Discord client instance (unused but kept for API consistency)
 * @returns {Object} Generated command categories
 */
export function generateCommandCategories(_client) {
  const commandHandler = getCommandHandler();
  const allCommands = commandHandler.getAllCommands();
  const categories = {};

  // Safety check for command handler
  if (!commandHandler || !allCommands || allCommands.length === 0) {
    console.warn(
      "Command handler not available or no commands found, using fallback categories",
    );
    // Return categories with empty commands arrays for safety
    const fallbackCategories = {};
    for (const [key, config] of Object.entries(COMMAND_CATEGORIES)) {
      fallbackCategories[key] = {
        ...config,
        commands: [],
      };
    }
    return fallbackCategories;
  }

  // Initialize categories with their base configuration
  for (const [categoryKey, categoryConfig] of Object.entries(
    COMMAND_CATEGORIES,
  )) {
    categories[categoryKey] = {
      ...categoryConfig,
      commands: [],
    };
  }

  // Categorize commands based on patterns and rules
  for (const commandName of allCommands) {
    let categorized = false;

    // Check each category's patterns
    for (const [categoryKey, categoryConfig] of Object.entries(categories)) {
      const patterns = categoryConfig.commandPatterns;

      for (const pattern of patterns) {
        if (commandName.includes(pattern) || commandName === pattern) {
          categories[categoryKey].commands.push(commandName);
          categorized = true;
          break;
        }
      }

      if (categorized) break;
    }

    // If not categorized, put in general
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
  for (const [categoryKey, categoryConfig] of Object.entries(categories)) {
    if (categoryConfig.commands.length === 0) {
      delete categories[categoryKey];
    }
  }

  return categories;
}

/**
 * Get the complete dynamic help data
 * @param {Client} client - Discord client instance
 * @returns {Object} Complete help data with metadata and categories
 */
export function getDynamicHelpData(client) {
  // Safety check for client
  if (!client) {
    console.warn("Client not available, using fallback help data");
    return {
      COMMAND_METADATA: {},
      COMMAND_CATEGORIES,
    };
  }

  return {
    COMMAND_METADATA: generateCommandMetadata(client),
    COMMAND_CATEGORIES: generateCommandCategories(client),
  };
}

/**
 * Get complexity indicator emoji
 * @param {string} complexity
 * @returns {string}
 */
export function getComplexityIndicator(complexity) {
  switch (complexity?.toLowerCase()) {
    case "easy":
      return EMOJIS.COMPLEXITY.EASY;
    case "medium":
      return EMOJIS.COMPLEXITY.MEDIUM;
    case "hard":
      return EMOJIS.COMPLEXITY.HARD;
    default:
      return "⚪";
  }
}

/**
 * Get usage frequency indicator
 * @param {string} usage
 * @returns {string}
 */
export function getUsageIndicator(usage) {
  switch (usage?.toLowerCase()) {
    case "high":
      return EMOJIS.USAGE.HIGH;
    case "medium":
      return EMOJIS.USAGE.MEDIUM;
    case "low":
      return EMOJIS.USAGE.LOW;
    default:
      return EMOJIS.USAGE.NONE;
  }
}
