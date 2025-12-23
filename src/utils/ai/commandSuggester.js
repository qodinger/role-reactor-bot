import { getLogger } from "../logger.js";
import { commandDiscoverer } from "./commandDiscoverer.js";

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
      this.commands = commandDiscoverer.getBotCommands(client);
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
   */
  buildKeywordMap() {
    this.commandKeywords.clear();

    // Command-specific keywords
    const keywordMap = {
      help: ["help", "commands", "what can you do", "list commands"],
      ping: ["ping", "latency", "response time", "speed"],
      avatar: ["avatar", "profile picture", "pfp", "picture"],
      "8ball": ["8ball", "magic 8 ball", "question", "predict"],
      poll: ["poll", "vote", "survey", "opinion"],
      rps: ["rock paper scissors", "rps", "game", "play"],
      wyr: ["would you rather", "wyr", "choice", "prefer"],
      serverinfo: ["server", "server info", "guild", "server details"],
      userinfo: ["user", "user info", "member", "profile"],
      level: ["level", "xp", "experience", "rank"],
      leaderboard: ["leaderboard", "top", "ranking", "best"],
      core: ["core", "credits", "balance", "currency"],
      invite: ["invite", "link", "join", "add bot"],
      support: ["support", "help", "discord", "server"],
      sponsor: ["sponsor", "donate", "premium", "ko-fi"],
      ask: ["ask", "question", "chat", "ai"],
    };

    for (const [command, keywords] of Object.entries(keywordMap)) {
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
   * @param {string} commandName - Command name
   * @returns {string} Command description
   */
  getCommandDescription(commandName) {
    const descriptions = {
      help: "View all available commands",
      ping: "Check bot latency and response time",
      avatar: "Generate or view user avatars",
      "8ball": "Ask the magic 8-ball a question",
      poll: "Create a poll for voting",
      rps: "Play rock paper scissors",
      wyr: "Would you rather questions",
      serverinfo: "View server information",
      userinfo: "View user information",
      level: "Check your level and XP",
      leaderboard: "View server leaderboard",
      core: "Check your Core balance",
      invite: "Get bot invite link",
      support: "Get support server link",
      sponsor: "View sponsorship information",
      ask: "Chat with the AI",
    };

    return descriptions[commandName] || `Use the /${commandName} command`;
  }
}

export const commandSuggester = new CommandSuggester();
