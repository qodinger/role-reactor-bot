import { getLogger } from "../logger.js";
import { commandRegistry } from "../core/commandRegistry.js";

const logger = getLogger();

/**
 * Command suggestion engine for AI
 * Analyzes user messages and suggests relevant commands
 */
export class CommandSuggester {
  constructor() {
    this.commands = [];
    this.commandKeywords = new Map();
    this.initialized = false;
  }

  /**
   * Initialize command suggestions by discovering available commands
   */
  async initialize(client) {
    if (this.initialized && this.client === client) return;

    try {
      if (!client) {
        logger.warn(
          "[CommandSuggester] Client not provided, skipping initialization",
        );
        return;
      }
      this.client = client;

      // Initialize command registry first
      await commandRegistry.initialize(client);

      // Get commands from registry (auto-discovered)
      this.commands = commandRegistry.getAllCommandNames();

      // Build keyword map from registry
      this.buildKeywordMap();
      this.initialized = true;
      logger.debug(
        `[CommandSuggester] Initialized with ${this.commands.length} commands`,
      );
    } catch (error) {
      logger.error("[CommandSuggester] Failed to initialize:", error);
    }
  }

  /**
   * Build keyword map for command matching
   * Now uses centralized command registry
   */
  buildKeywordMap() {
    this.commandKeywords.clear();

    // Get keywords from command registry (auto-discovered from commands)
    const keywordMap = commandRegistry.getAllCommandKeywords();

    // Only include commands that exist
    for (const [command, keywords] of keywordMap.entries()) {
      if (this.commands.includes(command)) {
        this.commandKeywords.set(command, keywords);
      }
    }
  }

  /**
   * Suggest commands based on user message
   * @param {string} userMessage - User's message
   * @param {import('discord.js').Client} client - Discord client
   * @param {number} maxSuggestions - Maximum number of suggestions
   * @returns {Promise<Array<string>>} Array of suggested command names
   */
  async suggestCommands(userMessage, client, maxSuggestions = 3) {
    if (!this.initialized || this.client !== client) {
      await this.initialize(client);
    }

    if (!userMessage || typeof userMessage !== "string") {
      return [];
    }

    const message = userMessage.toLowerCase();
    const scores = new Map();

    // Score each command based on keyword matches
    for (const [command, keywords] of this.commandKeywords.entries()) {
      let score = 0;

      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          // Exact match gets higher score
          if (message === keyword || message.includes(` ${keyword} `)) {
            score += 3;
          } else {
            score += 1;
          }
        }
      }

      if (score > 0) {
        scores.set(command, score);
      }
    }

    // Sort by score (descending) and return top suggestions
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxSuggestions)
      .map(([command]) => command);

    return sorted;
  }

  /**
   * Format command suggestions for AI context
   * @param {Array<string>} suggestions - Suggested command names
   * @returns {string} Formatted suggestion text
   */
  formatSuggestions(suggestions) {
    if (suggestions.length === 0) {
      return "";
    }

    if (suggestions.length === 1) {
      return `\n💡 **Suggestion**: The user might want to use \`/${suggestions[0]}\` command.`;
    }

    const commandList = suggestions.map(cmd => `\`/${cmd}\``).join(", ");
    return `\n💡 **Suggestions**: The user might want to use these commands: ${commandList}`;
  }

  /**
   * Get command description for suggestions
   * Now uses centralized command registry
   * @param {string} commandName - Command name
   * @returns {string} Command description
   */
  getCommandDescription(commandName) {
    return commandRegistry.getCommandDescription(commandName);
  }
}

export const commandSuggester = new CommandSuggester();
