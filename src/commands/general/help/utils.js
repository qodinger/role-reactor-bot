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
 * Get command category from command name
 * @param {string} commandName - The command name
 * @returns {string} Category name
 */
export function getCommandCategory(commandName) {
  if (!commandName) return "general";

  // Check for admin commands
  if (
    commandName.includes("role-reactions") ||
    commandName.includes("temp-roles") ||
    commandName.includes("welcome") ||
    commandName.includes("goodbye") ||
    commandName.includes("xp")
  ) {
    return "admin";
  }

  // Check for developer commands
  if (
    commandName.includes("health") ||
    commandName.includes("performance") ||
    commandName.includes("storage")
  ) {
    return "developer";
  }

  // Default to general
  return "general";
}

/**
 * Sort commands by category and name
 * @param {Array} commands - Array of command objects
 * @returns {Object} Sorted commands by category
 */
export function sortCommandsByCategory(commands) {
  const sorted = {
    admin: [],
    general: [],
    developer: [],
  };

  commands.forEach(command => {
    const category = getCommandCategory(command.name);
    sorted[category].push(command);
  });

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
