import { getLogger } from "../../../utils/logger.js";

// ============================================================================
// HELP UTILITY FUNCTIONS
// ============================================================================

/**
 * Format command name for display
 * @param {string} commandName - The command name
 * @returns {string} Formatted command name
 */
export function formatCommandName(commandName) {
  if (!commandName) return "Unknown";
  return `/${commandName}`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Validate command name
 * @param {string} commandName - Command name to validate
 * @returns {boolean} Whether the command name is valid
 */
export function isValidCommandName(commandName) {
  if (!commandName || typeof commandName !== "string") return false;

  // Command names should be lowercase, alphanumeric with hyphens/underscores
  const validPattern = /^[a-z0-9-_]+$/;
  return validPattern.test(commandName);
}

/**
 * Get command category from command name using registry
 * @param {string} commandName - The command name
 * @param {import('discord.js').Client} [client] - Discord client (optional, for registry initialization)
 * @returns {Promise<string>} Category name
 */
export async function getCommandCategory(commandName, client = null) {
  if (!commandName) return "general";

  // Initialize registry if client is provided
  if (client) {
    const { commandRegistry } = await import(
      "../../../utils/core/commandRegistry.js"
    );
    await commandRegistry.initialize(client);
    const metadata = commandRegistry.getCommandMetadata(commandName);
    if (metadata?.category) {
      return metadata.category;
    }
  }

  // Fallback to general if registry not available
  return "general";
}

/**
 * Sort commands by category and name using registry (if client provided) or fallback pattern matching
 * @param {Array} commands - Array of command objects
 * @param {import('discord.js').Client} [client] - Discord client (optional, for registry initialization)
 * @returns {Promise<Object>} Sorted commands by category
 */
export async function sortCommandsByCategory(commands, client = null) {
  const sorted = {
    admin: [],
    general: [],
    developer: [],
  };

  // Initialize registry if client is provided
  if (client) {
    const { commandRegistry } = await import(
      "../../../utils/core/commandRegistry.js"
    );
    await commandRegistry.initialize(client);

    commands.forEach(command => {
      const metadata = commandRegistry.getCommandMetadata(command.name);
      const category = metadata?.category || "general";
      if (sorted[category]) {
        sorted[category].push(command);
      } else {
        sorted.general.push(command);
      }
    });
  } else {
    // Fallback: use simple pattern matching if no client
    commands.forEach(command => {
      let category = "general";
      const name = command.name?.toLowerCase() || "";

      // Simple pattern matching fallback
      if (
        name.includes("role-reactions") ||
        name.includes("temp-roles") ||
        name.includes("welcome") ||
        name.includes("goodbye") ||
        name.includes("xp") ||
        name.includes("moderation") ||
        name.includes("voice-roles") ||
        name.includes("schedule-role")
      ) {
        category = "admin";
      } else if (
        name.includes("health") ||
        name.includes("performance") ||
        name.includes("storage") ||
        name.includes("core-management") ||
        name.includes("imagine")
      ) {
        category = "developer";
      }

      sorted[category].push(command);
    });
  }

  // Sort each category alphabetically
  Object.keys(sorted).forEach(category => {
    sorted[category].sort((a, b) => a.name.localeCompare(b.name));
  });

  return sorted;
}

/**
 * Generate help search suggestions
 * @param {Array} commands - Array of available commands
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of suggestions
 * @returns {Array} Filtered and sorted suggestions
 */
export function generateSearchSuggestions(commands, query, limit = 10) {
  if (!query || query.length < 2) {
    return commands.slice(0, limit);
  }

  const queryLower = query.toLowerCase();
  const scored = commands.map(cmd => {
    const nameLower = cmd.name.toLowerCase();
    const descLower = (cmd.description || "").toLowerCase();

    let score = 0;

    // Exact name match gets highest score
    if (nameLower === queryLower) score += 100;
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) score += 50;
    // Name contains query
    else if (nameLower.includes(queryLower)) score += 25;
    // Description contains query
    else if (descLower.includes(queryLower)) score += 10;

    return { ...cmd, score };
  });

  // Sort by score (highest first) then alphabetically
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return scored.slice(0, limit);
}

/**
 * Log help command usage for analytics
 * @param {string} commandName - Command name if specific help requested
 * @param {string} category - Category if category help requested
 * @param {string} userId - User ID requesting help
 */
export function logHelpUsage(commandName, category, userId) {
  const logger = getLogger();

  const usageData = {
    type: "help_command",
    userId,
    timestamp: new Date().toISOString(),
    commandName: commandName || null,
    category: category || null,
  };

  logger.info("Help command usage", usageData);
}
