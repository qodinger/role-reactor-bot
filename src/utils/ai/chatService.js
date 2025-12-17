import dedent from "dedent";
import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import {
  getMemberCounts,
  getChannelCounts,
  calculateServerAge,
  formatFeatures,
} from "../../commands/general/serverinfo/utils.js";

const logger = getLogger();

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_HISTORY_LENGTH = 20;
const DEFAULT_CONVERSATION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_CONVERSATIONS = 1000;
const SYSTEM_MESSAGE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_SYSTEM_CACHE_SIZE = 500;
const MEMBER_FETCH_TIMEOUT = 5000; // 5 seconds
const MAX_MEMBER_FETCH_SERVER_SIZE = 1000;
const MAX_MEMBERS_TO_DISPLAY = 50;
const MAX_RESPONSE_LENGTH = 2000; // Discord embed limit is 4096, but we use 2000 for safety
const DEFAULT_RESPONSE_LENGTH = 500; // Default concise response length
const FOLLOW_UP_QUERY_TIMEOUT = 30000; // 30 seconds for follow-up queries

// JSON parsing patterns
const JSON_MARKDOWN_PATTERNS = {
  jsonBlock: /^```json\s*/i,
  codeBlock: /^```\s*/i,
  closingBlock: /\s*```$/i,
  jsonObject: /\{[\s\S]*\}/,
};

// Follow-up prompt template (when data is fetched)
const FOLLOW_UP_PROMPT_TEMPLATE = dedent`
  I've fetched the data. The member list is now in the system context above in the "COMPLETE LIST OF HUMAN MEMBER NAMES" section.

  **CRITICAL INSTRUCTIONS:**
  1. Look at the "COMPLETE LIST OF HUMAN MEMBER NAMES" section in the system context above
  2. Find the numbered list (e.g., "1. Name1\\n2. Name2\\n3. Name3")
  3. Copy the EXACT names from that numbered list - type them character by character as shown
  4. Do NOT invent, guess, or make up ANY member names
  5. Do NOT use generic names like "iFunny", "Reddit", "Discord", "John", "Alice", "Bob", "Charlie"
  6. Use ONLY the actual member names from the numbered list in the "COMPLETE LIST OF HUMAN MEMBER NAMES" section

  Now provide the actual member names and information the user requested, using ONLY the names from the numbered list above.
`;

// ============================================================================
// CHAT SERVICE CLASS
// ============================================================================

/**
 * Chat service for AI-powered conversations with bot and server context
 */
export class ChatService {
  constructor() {
    this.aiService = multiProviderAIService;
    this.conversations = new Map();
    this.systemMessageCache = new Map();
    this.dbManager = null;

    // Configuration from environment variables
    this.useLongTermMemory = process.env.AI_USE_LONG_TERM_MEMORY !== "false";
    this.maxHistoryLength =
      parseInt(process.env.AI_CONVERSATION_HISTORY_LENGTH) ||
      DEFAULT_MAX_HISTORY_LENGTH;
    this.conversationTimeout =
      parseInt(process.env.AI_CONVERSATION_TIMEOUT) ||
      DEFAULT_CONVERSATION_TIMEOUT;
    this.maxConversations =
      parseInt(process.env.AI_MAX_CONVERSATIONS) || DEFAULT_MAX_CONVERSATIONS;

    // Initialize
    this.initLongTermMemory();
    this.startCleanup();
  }

  /**
   * Initialize long-term memory (MongoDB) if available
   */
  async initLongTermMemory() {
    if (!this.useLongTermMemory) {
      logger.debug(
        "Long-term memory disabled via AI_USE_LONG_TERM_MEMORY=false",
      );
      return;
    }

    try {
      this.dbManager = await getDatabaseManager();
      if (this.dbManager && this.dbManager.conversations) {
        logger.info("✅ Long-term memory (MongoDB) enabled for conversations");
        // Preload recent conversations (optional optimization)
        // This reduces first-request latency but uses more memory
        // Can be disabled by setting AI_PRELOAD_CONVERSATIONS=false
        if (process.env.AI_PRELOAD_CONVERSATIONS !== "false") {
          this.preloadRecentConversations().catch(error => {
            logger.debug("Failed to preload conversations:", error);
          });
        }
      } else {
        logger.debug("⚠️ MongoDB not available, using in-memory storage only");
        this.useLongTermMemory = false;
      }
    } catch (error) {
      logger.debug("⚠️ Failed to initialize long-term memory:", error.message);
      this.useLongTermMemory = false;
    }
  }

  /**
   * Preload recent conversations into memory cache (performance optimization)
   * Only loads conversations active in last 24 hours to avoid memory bloat
   */
  async preloadRecentConversations() {
    if (!this.useLongTermMemory || !this.dbManager?.conversations) {
      return;
    }

    try {
      const recentThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      const collection = this.dbManager.conversations.collection;
      const recent = await collection
        .find({
          lastActivity: { $gte: new Date(recentThreshold) },
        })
        .limit(100) // Limit to 100 most recent to avoid memory issues
        .toArray();

      let loaded = 0;
      for (const conv of recent) {
        const lastActivity = new Date(conv.lastActivity).getTime();
        // Only load if not expired
        if (Date.now() - lastActivity <= this.conversationTimeout) {
          this.conversations.set(conv.userId, {
            messages: conv.messages || [],
            lastActivity,
          });
          loaded++;
        }
      }

      if (loaded > 0) {
        logger.debug(
          `Preloaded ${loaded} recent conversation(s) into memory cache`,
        );
      }
    } catch (error) {
      logger.debug("Failed to preload conversations:", error);
    }
  }

  /**
   * Get conversation history for a user (with LTM support)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversationHistory(userId) {
    // Try in-memory cache first (fast)
    const cached = this.conversations.get(userId);
    if (cached) {
      // Check if conversation expired
      if (Date.now() - cached.lastActivity > this.conversationTimeout) {
        this.conversations.delete(userId);
        // Also delete from database if LTM enabled
        if (this.useLongTermMemory && this.dbManager?.conversations) {
          await this.dbManager.conversations.delete(userId).catch(() => {});
        }
        return [];
      }
      return cached.messages || [];
    }

    // If not in cache, try loading from database (LTM)
    if (this.useLongTermMemory && this.dbManager?.conversations) {
      try {
        const dbConversation =
          await this.dbManager.conversations.getByUser(userId);
        if (dbConversation) {
          const lastActivity = new Date(dbConversation.lastActivity).getTime();
          // Check if expired
          if (Date.now() - lastActivity > this.conversationTimeout) {
            await this.dbManager.conversations.delete(userId);
            return [];
          }
          // Load into memory cache
          this.conversations.set(userId, {
            messages: dbConversation.messages || [],
            lastActivity,
          });
          return dbConversation.messages || [];
        }
      } catch (error) {
        logger.debug("Failed to load conversation from database:", error);
      }
    }

    return [];
  }

  /**
   * Add message to conversation history (with LTM support)
   * @param {string} userId - User ID
   * @param {Object} message - Message object with role and content
   */
  async addToHistory(userId, message) {
    if (!userId) return;

    // Enforce conversation limit - remove oldest if at capacity
    if (this.conversations.size >= this.maxConversations) {
      this.evictOldestConversation();
    }

    let conversation = this.conversations.get(userId);
    if (!conversation) {
      conversation = {
        messages: [],
        lastActivity: Date.now(),
      };
      this.conversations.set(userId, conversation);
    }

    // Update last activity
    conversation.lastActivity = Date.now();

    // Add message (optimized: don't store timestamp to save memory)
    conversation.messages.push({
      role: message.role,
      content: message.content,
    });

    // Optimized: Keep only last N messages (excluding system message)
    // More efficient: track system message index instead of searching
    const nonSystemMessages = conversation.messages.filter(
      m => m.role !== "system",
    );
    if (nonSystemMessages.length > this.maxHistoryLength) {
      // Remove oldest messages (keep system + recent messages)
      const systemMessage =
        conversation.messages[0]?.role === "system"
          ? conversation.messages[0]
          : null;
      const recentMessages = nonSystemMessages.slice(-this.maxHistoryLength);
      conversation.messages = systemMessage
        ? [systemMessage, ...recentMessages]
        : recentMessages;
    }

    // Save to database for LTM (async, don't wait)
    if (this.useLongTermMemory && this.dbManager?.conversations) {
      this.dbManager.conversations
        .save(userId, conversation.messages, conversation.lastActivity)
        .catch(error => {
          logger.debug("Failed to save conversation to database:", error);
        });
    }
  }

  /**
   * Evict oldest conversation when at capacity (LRU-style)
   */
  evictOldestConversation() {
    let oldestUserId = null;
    let oldestTime = Date.now();

    for (const [userId, conversation] of this.conversations.entries()) {
      if (conversation.lastActivity < oldestTime) {
        oldestTime = conversation.lastActivity;
        oldestUserId = userId;
      }
    }

    if (oldestUserId) {
      this.conversations.delete(oldestUserId);
      logger.debug(`Evicted oldest conversation for user ${oldestUserId}`);
    }
  }

  /**
   * Clear conversation history for a user (with LTM support)
   * @param {string} userId - User ID
   */
  async clearHistory(userId) {
    if (userId) {
      this.conversations.delete(userId);
      // Also delete from database if LTM enabled
      if (this.useLongTermMemory && this.dbManager?.conversations) {
        await this.dbManager.conversations.delete(userId).catch(() => {});
      }
    }
  }

  /**
   * Start cleanup interval for expired conversations (optimized)
   */
  startCleanup() {
    // Clean up expired conversations every 3 minutes (more frequent for better memory management)
    setInterval(
      () => {
        const now = Date.now();
        let cleaned = 0;
        const toDelete = [];

        // Collect expired conversations first (more efficient)
        for (const [userId, conversation] of this.conversations.entries()) {
          if (now - conversation.lastActivity > this.conversationTimeout) {
            toDelete.push(userId);
          }
        }

        // Delete in batch
        for (const userId of toDelete) {
          this.conversations.delete(userId);
          cleaned++;
        }

        // Clean up expired system message cache
        let cacheCleaned = 0;
        const cacheToDelete = [];
        for (const [key, cached] of this.systemMessageCache.entries()) {
          if (now - cached.timestamp > this.systemMessageCacheTimeout) {
            cacheToDelete.push(key);
          }
        }
        for (const key of cacheToDelete) {
          this.systemMessageCache.delete(key);
          cacheCleaned++;
        }

        if (cleaned > 0 || cacheCleaned > 0) {
          logger.debug(
            `Cleaned up ${cleaned} expired conversation(s) and ${cacheCleaned} cache entry(ies)`,
          );
        }
      },
      3 * 60 * 1000,
    ); // Every 3 minutes
  }

  /**
   * Extract option information from Discord.js command option
   * @param {Object} option - Discord.js command option
   * @returns {string} Formatted option description
   */
  formatOption(option) {
    const typeMap = {
      1: "subcommand",
      2: "subcommandGroup",
      3: "string",
      4: "integer",
      5: "boolean",
      6: "user",
      7: "channel",
      8: "role",
      9: "mentionable",
      10: "number",
      11: "attachment",
    };

    const type = typeMap[option.type] || `type_${option.type}`;

    // Start with description if available, otherwise use type
    let desc = option.description || `${type} parameter`;

    // Add required/optional indicator
    if (!option.required) {
      desc += " (optional)";
    }

    // Add choices if available (for string/integer/number options)
    if (Array.isArray(option.choices) && option.choices.length > 0) {
      const choices = option.choices
        .slice(0, 5)
        .map(c => c.name || String(c.value))
        .join(", ");
      desc += ` [choices: ${choices}${option.choices.length > 5 ? "..." : ""}]`;
    }

    // Add min/max values for numeric types
    if (option.type === 4 || option.type === 10) {
      // Integer or Number
      const constraints = [];
      if (typeof option.minValue === "number") {
        constraints.push(`min: ${option.minValue}`);
      }
      if (typeof option.maxValue === "number") {
        constraints.push(`max: ${option.maxValue}`);
      }
      if (constraints.length > 0) {
        desc += ` [${constraints.join(", ")}]`;
      }
    }

    // Add max length for string options
    if (option.type === 3 && typeof option.maxLength === "number") {
      desc += ` [max length: ${option.maxLength}]`;
    }

    return desc;
  }

  /**
   * Extract subcommand information
   * @param {Object} subcommand - Discord.js subcommand
   * @returns {Object} Formatted subcommand info
   */
  extractSubcommand(subcommand) {
    const info = {
      name: subcommand.name,
      description: subcommand.description || "No description",
      options: [],
    };

    if (subcommand.options) {
      for (const option of subcommand.options) {
        // Subcommands can only contain regular options (types 3-11), not nested subcommands
        // Type 1 (subcommand) and 2 (subcommand group) only appear at command root level
        if (option.type >= 3) {
          // Regular option (string, integer, boolean, user, channel, role, mentionable, number, attachment)
          info.options.push({
            name: option.name,
            description: this.formatOption(option),
            required: option.required || false,
          });
        }
        // Ignore unexpected types (shouldn't happen in valid Discord commands)
      }
    }

    return info;
  }

  /**
   * Get bot commands with full structure (subcommands, options) - completely dynamic
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Array} Array of command objects with full structure
   */
  getBotCommands(client) {
    if (!client?.commands) {
      return [];
    }

    const commands = [];
    for (const [name, command] of client.commands.entries()) {
      // Validate command structure
      if (!command || !command.data) {
        continue;
      }

      // Get command data - use toJSON() for reliable structure, fallback to direct access
      let cmdData;
      try {
        // Try toJSON() first (most reliable for SlashCommandBuilder)
        cmdData =
          typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;
      } catch (_error) {
        // Fallback to direct property access
        cmdData = command.data;
      }

      // Ensure we have required properties
      const cmdName = cmdData.name || name;
      if (!cmdName) {
        continue; // Skip invalid commands
      }

      const cmdInfo = {
        name: cmdName,
        description: cmdData.description || "No description available",
        subcommands: [],
        options: [],
        defaultMemberPermissions:
          cmdData.default_member_permissions || cmdData.defaultMemberPermissions
            ? "Requires permissions"
            : "Available to all users",
      };

      // Extract subcommands and options
      const options = cmdData.options || [];
      if (Array.isArray(options) && options.length > 0) {
        for (const option of options) {
          // Validate option has required properties
          if (!option || typeof option.type !== "number") {
            continue;
          }

          if (option.type === 1) {
            // Subcommand (type 1)
            if (option.name && option.description !== undefined) {
              cmdInfo.subcommands.push(this.extractSubcommand(option));
            }
          } else if (option.type === 2) {
            // Subcommand group (type 2)
            if (option.name) {
              const group = {
                name: option.name,
                description: option.description || "No description",
                subcommands: [],
              };
              const groupOptions = option.options || [];
              if (Array.isArray(groupOptions)) {
                for (const subcmd of groupOptions) {
                  if (subcmd && subcmd.type === 1 && subcmd.name) {
                    group.subcommands.push(this.extractSubcommand(subcmd));
                  }
                }
              }
              if (group.subcommands.length > 0) {
                cmdInfo.subcommands.push(group);
              }
            }
          } else if (option.type >= 3 && option.type <= 11) {
            // Regular option (types 3-11: string, integer, boolean, user, channel, role, mentionable, number, attachment)
            if (option.name) {
              cmdInfo.options.push({
                name: option.name,
                description: this.formatOption(option),
                required: option.required || false,
              });
            }
          }
          // Ignore unknown types (future Discord API additions)
        }
      }

      commands.push(cmdInfo);
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Detect which commands are mentioned in user message
   * @param {string} userMessage - User's message
   * @param {Array} allCommands - All available commands
   * @returns {Array} Array of relevant command names
   */
  detectMentionedCommands(userMessage, allCommands) {
    const messageLower = userMessage.toLowerCase();
    const mentioned = [];

    for (const cmd of allCommands) {
      // Check if command name is mentioned
      if (messageLower.includes(cmd.name.toLowerCase())) {
        mentioned.push(cmd.name);
        continue;
      }

      // Check common aliases/terms
      const aliases = {
        rps: ["rock paper scissors", "rock-paper-scissors", "rps game"],
        poll: ["poll", "vote", "voting", "survey"],
        avatar: ["avatar", "profile picture", "pfp"],
        ping: ["ping", "latency", "response time"],
        help: ["help", "commands", "what can you do"],
        serverinfo: ["server info", "server information", "guild info"],
        userinfo: ["user info", "user information", "who is"],
        level: ["level", "xp", "experience", "rank"],
        leaderboard: ["leaderboard", "top", "ranking"],
        wyr: ["would you rather", "wyr"],
        "8ball": ["8ball", "magic 8", "fortune"],
      };

      if (aliases[cmd.name]) {
        for (const alias of aliases[cmd.name]) {
          if (messageLower.includes(alias)) {
            mentioned.push(cmd.name);
            break;
          }
        }
      }
    }

    return [...new Set(mentioned)]; // Remove duplicates
  }

  /**
   * Dynamically discover commands that need data fetching (commands with ID-requiring subcommands)
   * @param {Array} allCommands - All available commands
   * @returns {Array} Array of {commandName, idParamName, actionName, description}
   */
  discoverDataFetchingCommands(allCommands) {
    const idPatterns = [
      {
        pattern: /message[-_]?id/i,
        actionPrefix: "get_role_reaction_messages",
      },
      { pattern: /schedule[-_]?id/i, actionPrefix: "get_scheduled_roles" },
      { pattern: /poll[-_]?id/i, actionPrefix: "get_polls" },
      { pattern: /case[-_]?id/i, actionPrefix: "get_moderation_history" },
    ];

    const commandsNeedingData = [];
    const seenActions = new Set();

    for (const cmd of allCommands) {
      // Check all subcommands for ID-requiring options
      for (const subcmd of cmd.subcommands || []) {
        const subcmdName = subcmd.name || subcmd;
        const subcmdOptions = subcmd.options || [];

        // Check if this subcommand requires an ID parameter
        for (const option of subcmdOptions) {
          const optionName = option.name || "";
          const optionDesc = option.description || "";

          // Look for ID patterns in option name or description
          for (const { pattern, actionPrefix } of idPatterns) {
            if (pattern.test(optionName) || pattern.test(optionDesc)) {
              // Check if this is an update/delete/view/cancel/end operation
              const isIdRequiringOperation = [
                "update",
                "delete",
                "view",
                "cancel",
                "end",
                "remove",
              ].includes(subcmdName.toLowerCase());

              if (isIdRequiringOperation && !seenActions.has(actionPrefix)) {
                seenActions.add(actionPrefix);
                commandsNeedingData.push({
                  commandName: cmd.name,
                  idParamName: optionName,
                  actionName: actionPrefix,
                  description: this.getDataFetchingDescription(
                    cmd.name,
                    actionPrefix,
                  ),
                });
                break; // Found ID requirement for this command
              }
            }
          }
        }
      }
    }

    return commandsNeedingData;
  }

  /**
   * Get description for data fetching action
   * @param {string} commandName - Command name
   * @param {string} actionName - Action name
   * @returns {string} Description
   */
  getDataFetchingDescription(commandName, actionName) {
    const descriptions = {
      get_role_reaction_messages:
        "Get all existing role reaction messages (returns message IDs needed for updates)",
      get_scheduled_roles:
        "Get all scheduled roles (returns schedule IDs needed for view/cancel/delete)",
      get_polls:
        "Get all polls in server (returns poll IDs needed for end/delete)",
      get_moderation_history:
        "Get moderation history (returns case IDs needed for remove-warn)",
    };

    return (
      descriptions[actionName] ||
      `Get data for ${commandName} command (returns IDs needed for operations)`
    );
  }

  /**
   * Get detailed info for specific commands (on-demand injection)
   * @param {Array} commandNames - Command names to get details for
   * @param {Array} allCommands - All available commands
   * @returns {string} Formatted command details
   */
  getCommandDetails(commandNames, allCommands) {
    if (commandNames.length === 0) return "";

    const commands = allCommands.filter(cmd => commandNames.includes(cmd.name));

    if (commands.length === 0) return "";

    let details = "\nRelevant Commands:\n";

    const formatCommand = cmd => {
      let formatted = `/${cmd.name}: ${cmd.description}`;

      if (cmd.subcommands && cmd.subcommands.length > 0) {
        formatted += "\n  Subcommands:";
        for (const subcmd of cmd.subcommands) {
          if (subcmd.subcommands && subcmd.subcommands.length > 0) {
            // Subcommand group
            formatted += `\n    ${subcmd.name} (group):`;
            for (const nestedSubcmd of subcmd.subcommands) {
              formatted += `\n      - /${cmd.name} ${subcmd.name} ${nestedSubcmd.name}: ${nestedSubcmd.description}`;
              if (nestedSubcmd.options && nestedSubcmd.options.length > 0) {
                const optionDetails = nestedSubcmd.options
                  .slice(0, 5)
                  .map(o => {
                    let optStr = o.name;
                    if (o.description && !o.description.includes("type_")) {
                      const desc =
                        o.description.length > 40
                          ? `${o.description.substring(0, 37)}...`
                          : o.description;
                      optStr = `${optStr} (${desc})`;
                    }
                    return optStr;
                  })
                  .join(", ");
                const moreOpts = nestedSubcmd.options.length > 5 ? "..." : "";
                formatted += `\n        Options: ${optionDetails}${moreOpts}`;
              }
            }
          } else {
            // Regular subcommand
            formatted += `\n    - /${cmd.name} ${subcmd.name}: ${subcmd.description}`;
            if (subcmd.options && subcmd.options.length > 0) {
              const optionDetails = subcmd.options
                .slice(0, 5)
                .map(o => {
                  // Use the full description from formatOption (includes choices, constraints)
                  let optStr = o.name;
                  if (o.description && !o.description.includes("type_")) {
                    // Don't truncate if description contains choices or important info
                    const hasChoices = o.description.includes("[choices:");
                    const hasConstraints =
                      o.description.includes("[min:") ||
                      o.description.includes("[max:");
                    const maxLen = hasChoices || hasConstraints ? 80 : 50;
                    const desc =
                      o.description.length > maxLen
                        ? `${o.description.substring(0, maxLen - 3)}...`
                        : o.description;
                    optStr = `${optStr} (${desc})`;
                  }
                  return optStr;
                })
                .join(", ");
              const moreOpts = subcmd.options.length > 5 ? "..." : "";
              formatted += `\n      Options: ${optionDetails}${moreOpts}`;
            }
            // Add example usage for common commands
            if (subcmd.name === "play" && cmd.name === "rps") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} choice:rock`;
            } else if (subcmd.name === "challenge" && cmd.name === "rps") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} user:@someone choice:paper`;
            } else if (subcmd.name === "list" && cmd.name === "poll") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} page:1 show-ended:false`;
            } else if (subcmd.name === "create" && cmd.name === "poll") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} (opens interactive form)`;
            }
          }
        }
      } else if (cmd.options && cmd.options.length > 0) {
        const optionDetails = cmd.options
          .slice(0, 5)
          .map(o => {
            // Use the full description from formatOption (includes choices, constraints)
            let optStr = o.name;
            if (o.description && !o.description.includes("type_")) {
              // Don't truncate if description contains choices or important info
              const hasChoices = o.description.includes("[choices:");
              const hasConstraints =
                o.description.includes("[min:") ||
                o.description.includes("[max:");
              const maxLen = hasChoices || hasConstraints ? 80 : 50;
              const desc =
                o.description.length > maxLen
                  ? `${o.description.substring(0, maxLen - 3)}...`
                  : o.description;
              optStr = `${optStr} (${desc})`;
            }
            return optStr;
          })
          .join(", ");
        const moreOpts = cmd.options.length > 5 ? "..." : "";
        formatted += `\n  Options: ${optionDetails}${moreOpts}`;
        // Add examples for commands with direct options
        if (cmd.name === "avatar") {
          formatted += `\n  Example: /${cmd.name} prompt:"cyberpunk hacker" art_style:modern`;
        } else if (cmd.name === "leaderboard") {
          formatted += `\n  Example: /${cmd.name} limit:10 type:xp`;
        } else if (cmd.name === "8ball") {
          formatted += `\n  Example: /${cmd.name} question:"Will it rain today?"`;
        }
      }

      return formatted;
    };

    for (const cmd of commands) {
      details += `${formatCommand(cmd)}\n`;
    }

    return details;
  }

  /**
   * Sanitize data to prevent exposing sensitive information
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeData(text) {
    if (!text || typeof text !== "string") return text;

    let sanitized = text;

    // Remove specific API key patterns (more precise to avoid false positives)
    const sensitivePatterns = [
      // OpenAI API keys
      /sk-[a-zA-Z0-9]{32,}/gi,
      // Stability AI keys (starts with specific prefix)
      /sk-[a-zA-Z0-9]{40,}/gi,
      // Generic bearer tokens
      /Bearer\s+[A-Za-z0-9]{32,}/gi,
      // GitHub tokens
      /ghp_[A-Za-z0-9]{36}/gi,
      // Slack tokens
      /xox[baprs]-[A-Za-z0-9-]+/gi,
      // AWS keys (but allow Discord IDs which are 17-19 digits)
      /AKIA[0-9A-Z]{16}/gi,
      // MongoDB connection strings (but be careful not to match Discord IDs)
      /mongodb\+srv:\/\/[^\s]+/gi,
      // Generic connection strings with credentials
      /[a-z]+:\/\/[^:]+:[^@]+@[^\s]+/gi,
    ];

    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    // Remove environment variable references (but allow normal text)
    sanitized = sanitized.replace(
      /\$\{[A-Z_]{3,}\}|process\.env\.[A-Z_]{3,}/g,
      "[CONFIG]",
    );

    // Remove potential base64 encoded secrets (but allow normal base64 images/data URLs)
    // Only match if it looks like a standalone token
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9+/]{40,}={0,2}\b(?![^\s]*data:image)/g,
      match => {
        // Don't redact if it's part of a data URL or looks like Discord asset
        if (match.includes("data:") || match.includes("discord")) {
          return match;
        }
        // Don't redact Discord IDs (17-19 digits)
        if (/^\d{17,19}$/.test(match)) {
          return match;
        }
        return "[REDACTED]";
      },
    );

    return sanitized;
  }

  /**
   * Get safe server information (no sensitive data)
   * Works universally for any Discord server
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @returns {Promise<string>} Formatted server information
   */
  async getServerInfo(guild, _client) {
    if (!guild) return "";

    try {
      const memberCounts = getMemberCounts(guild);
      const channelCounts = getChannelCounts(guild);
      const serverAge = calculateServerAge(guild.createdAt);

      let info = `**Server Name:** ${this.sanitizeData(guild.name)}\n\n`;

      // Basic server info (always available)
      info += `**Server Details:**\n`;
      if (guild.id) {
        info += `- Server ID: ${guild.id}\n`;
      }

      if (guild.createdAt) {
        info += `- Created: ${guild.createdAt.toLocaleDateString()} (${serverAge} ago)\n`;
      }

      // Owner info (may not be available in all cases)
      try {
        const owner = guild.members.cache.get(guild.ownerId);
        if (owner?.user?.tag) {
          info += `- Owner: ${owner.user.tag}\n`;
        }
      } catch (_error) {
        // Owner info not available, skip
      }
      info += `\n`;

      // Member statistics (handle cases where data might be limited)
      if (memberCounts) {
        info += `**Member Statistics:**\n`;
        // Emphasize human members - when asked "how many members", use THIS number
        if (memberCounts.humans !== undefined) {
          info += `🚨 **ANSWER: There are ${memberCounts.humans} human members in this server.**\n`;
          info += `- When asked "how many members", ALWAYS use this number: **${memberCounts.humans}**\n`;
        }
        if (memberCounts.total !== undefined) {
          info += `- Total Members (including bots): ${memberCounts.total}`;
          if (memberCounts.bots !== undefined) {
            info += ` (${memberCounts.bots} bots)`;
          }
          info += ` - DO NOT use this number when asked about "members"\n`;
        }

        // Presence data (may be limited without GUILD_PRESENCES intent)
        if (
          memberCounts.online !== undefined ||
          memberCounts.idle !== undefined
        ) {
          const online = memberCounts.online || 0;
          const idle = memberCounts.idle || 0;
          const dnd = memberCounts.dnd || 0;
          const offline = memberCounts.offline || 0;
          info += `- Status Breakdown: Online: ${online} | Idle: ${idle} | DND: ${dnd} | Offline: ${offline}\n`;
        }
        info += `\n`;
      }

      // Member names - Try to fetch all members for complete data
      // IMPORTANT: This section MUST be used when asked for member names
      try {
        let membersCollection = guild.members.cache;
        const cachedBeforeFetch = membersCollection.size;
        const totalMembers = guild.memberCount;
        let allMembersFetched = false;

        // If we don't have all members cached, try to fetch them
        if (
          cachedBeforeFetch < totalMembers &&
          totalMembers <= MAX_MEMBER_FETCH_SERVER_SIZE
        ) {
          try {
            logger.debug(
              `[getServerInfo] Fetching members: ${cachedBeforeFetch}/${totalMembers} cached`,
            );
            const fetchPromise = guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () => reject(new Error("Member fetch timed out")),
                MEMBER_FETCH_TIMEOUT,
              );
            });

            await Promise.race([fetchPromise, timeoutPromise]);
            membersCollection = guild.members.cache;
            allMembersFetched = membersCollection.size >= totalMembers * 0.95; // 95% threshold
            logger.debug(
              `[getServerInfo] Fetched members: ${membersCollection.size}/${totalMembers} (${allMembersFetched ? "complete" : "partial"})`,
            );
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.debug(
                `[getServerInfo] Member fetch timed out - using cached members`,
              );
            } else if (fetchError.message?.includes("Missing Access")) {
              logger.debug(
                `[getServerInfo] Missing GUILD_MEMBERS intent - using cached members`,
              );
            } else {
              logger.debug(
                `[getServerInfo] Failed to fetch members: ${fetchError.message} - using cached`,
              );
            }
            // Continue with cached members
            membersCollection = guild.members.cache;
          }
        } else if (cachedBeforeFetch >= totalMembers) {
          allMembersFetched = true;
        }

        if (membersCollection && membersCollection.size > 0) {
          // Get human members only (exclude bots)
          const humanMembers = Array.from(membersCollection.values())
            .filter(member => member && member.user && !member.user.bot)
            .map(member => {
              // Use displayName if available, otherwise username
              const name =
                member.displayName || member.user?.username || "Unknown";
              return this.sanitizeData(name);
            })
            .filter(name => name && name !== "Unknown")
            .slice(0, MAX_MEMBERS_TO_DISPLAY);

          logger.debug(
            `[getServerInfo] Human members found: ${humanMembers.length} (${allMembersFetched ? "complete" : "partial"})`,
          );

          // Get bot members
          const botMembers = Array.from(membersCollection.values())
            .filter(member => member && member.user && member.user.bot)
            .map(member => {
              const name =
                member.displayName || member.user?.username || "Unknown";
              return this.sanitizeData(name);
            })
            .filter(name => name && name !== "Unknown")
            .slice(0, MAX_MEMBERS_TO_DISPLAY);

          // Human members section
          if (humanMembers.length > 0) {
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            info += `**📋 COMPLETE LIST OF HUMAN MEMBER NAMES:**\n`;
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            info += `**🚨 CRITICAL: When asked for member names, use THIS EXACT LIST. Do NOT make up names!**\n\n`;

            // Format as numbered list for clarity
            humanMembers.forEach((name, index) => {
              info += `${index + 1}. ${name}\n`;
            });
            info += `\n`;

            // Also provide as structured JSON (easier for AI to parse)
            const humanDataJson = JSON.stringify(
              {
                type: "humans",
                members: humanMembers,
                count: humanMembers.length,
              },
              null,
              2,
            );
            info += `**Structured Data (JSON format):**\n\`\`\`json\n${humanDataJson}\n\`\`\`\n\n`;

            info += `**⚠️ REMEMBER: The ${humanMembers.length} names above are the ONLY human member names in this server. Use them EXACTLY as shown.**\n\n`;
            if (
              memberCounts?.humans &&
              memberCounts.humans > humanMembers.length &&
              !allMembersFetched
            ) {
              info += `⚠️ **Note:** Showing ${humanMembers.length} of ${memberCounts.humans} total human members (others not currently available - may need to wait for cache or server has >1000 members)\n`;
            } else if (
              allMembersFetched ||
              humanMembers.length === memberCounts?.humans
            ) {
              info += `✅ **Complete list:** All ${humanMembers.length} human members are shown above.\n`;
            }
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          } else {
            info += `**HUMAN MEMBERS:** No human members currently available.\n\n`;
            logger.warn(
              `[getServerInfo] No human members found for guild ${guild.id}`,
            );
          }

          // Bot members section
          if (botMembers.length > 0) {
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            info += `**🤖 COMPLETE LIST OF BOT NAMES:**\n`;
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            // Format as numbered list
            botMembers.forEach((name, index) => {
              info += `${index + 1}. ${name}\n`;
            });
            info += `\n`;

            // Also provide as structured JSON
            const botDataJson = JSON.stringify(
              {
                type: "bots",
                members: botMembers,
                count: botMembers.length,
              },
              null,
              2,
            );
            info += `**Structured Data (JSON format):**\n\`\`\`json\n${botDataJson}\n\`\`\`\n\n`;

            info += `**Total bots:** ${botMembers.length}\n`;
            info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          }
        } else {
          info += `**MEMBER NAMES:** No members currently available.\n\n`;
          logger.warn(
            `[getServerInfo] No members available for guild ${guild.id}`,
          );
        }
      } catch (error) {
        // Member names not available, skip
        logger.error(`[getServerInfo] Error retrieving member names:`, error);
        info += `**MEMBER NAMES:** Unable to retrieve member names.\n\n`;
      }

      // Channel statistics (handle missing data gracefully)
      if (channelCounts) {
        info += `**Channels:**\n`;
        const text = channelCounts.text || 0;
        const voice = channelCounts.voice || 0;
        const forum = channelCounts.forum || 0;
        const stage = channelCounts.stage || 0;
        const category = channelCounts.category || 0;
        const threads = channelCounts.threads || 0;

        info += `- Text Channels: ${text} | Voice Channels: ${voice}`;
        if (forum > 0) info += ` | Forum Channels: ${forum}`;
        if (stage > 0) info += ` | Stage Channels: ${stage}`;
        info += `\n`;
        info += `- Categories: ${category} | Threads: ${threads}\n\n`;
      }

      // Server features (optional, may not exist)
      try {
        if (
          guild.features &&
          Array.isArray(guild.features) &&
          guild.features.length > 0
        ) {
          const safeFeatures = formatFeatures(guild.features);
          if (safeFeatures && safeFeatures !== "None") {
            info += `**Server Features:** ${safeFeatures}\n`;
          }
        }
      } catch (_error) {
        // Features not available, skip
      }

      // Boost level (optional, only for boosted servers)
      try {
        if (
          guild.premiumSubscriptionCount &&
          guild.premiumSubscriptionCount > 0
        ) {
          info += `**Server Boosts:** Level ${guild.premiumTier || 0} (${guild.premiumSubscriptionCount} boosts)\n`;
        }
      } catch (_error) {
        // Boost info not available, skip
      }

      // Roles information
      try {
        if (guild.roles?.cache?.size !== undefined) {
          info += `**Roles (Permission Groups - NOT Member Names):**\n`;
          info += `- Total Roles: ${guild.roles.cache.size}\n`;

          // Top roles (non-sensitive, just names) - optional
          const topRoles = guild.roles.cache
            .filter(role => role && !role.managed && role.name !== "@everyone")
            .sort((a, b) => (b.position || 0) - (a.position || 0))
            .map(role => this.sanitizeData(role.name))
            .filter(name => name && name.length > 0)
            .slice(0, 10);

          if (topRoles.length > 0) {
            info += `- Top Role Names: ${topRoles.join(", ")}`;
            if (guild.roles.cache.size > 10) {
              info += ` (${guild.roles.cache.size - 10} more roles exist)`;
            }
            info += `\n`;
            info += `⚠️ **CRITICAL:** These are ROLE NAMES (permission groups), NOT member names! Do NOT use these when asked for member names!\n\n`;
          } else {
            info += `\n`;
          }
        }
      } catch (_error) {
        // Roles not available, skip
      }

      // Emojis and stickers (optional features)
      try {
        const emojiCount = guild.emojis?.cache?.size || 0;
        const stickerCount = guild.stickers?.cache?.size || 0;
        if (emojiCount > 0 || stickerCount > 0) {
          info += `**Server Assets:**\n`;
          info += `- Emojis: ${emojiCount} | Stickers: ${stickerCount}\n\n`;
        }
      } catch (_error) {
        // Emojis/stickers not available, skip
      }

      // Server description (optional, sanitized)
      try {
        if (guild.description) {
          const safeDesc = this.sanitizeData(guild.description);
          if (safeDesc && safeDesc.length > 0) {
            info += `**Server Description:**\n`;
            if (safeDesc.length > 200) {
              info += `${safeDesc.substring(0, 197)}...\n\n`;
            } else {
              info += `${safeDesc}\n\n`;
            }
          }
        }
      } catch (_error) {
        // Description not available, skip
      }

      return info;
    } catch (error) {
      logger.error("Error building server info:", error);
      // Return minimal safe info if there's an error
      return `Current Server: ${this.sanitizeData(guild.name || "Unknown")}\n\n`;
    }
  }

  /**
   * Get safe bot information (no sensitive config)
   * Works universally regardless of bot configuration
   * @param {import('discord.js').Client} client - Discord client
   * @returns {string} Formatted bot information
   */
  async getBotInfo(client) {
    if (!client || !client.user) return "";

    try {
      const config = (await import("../../config/config.js")).default;
      const externalLinks = config.externalLinks || {};

      let info = `Bot Information:\n`;

      // Basic bot info (always available)
      if (client.user.username) {
        info += `- Name: ${client.user.username}\n`;
      }

      if (client.user.tag) {
        info += `- Tag: ${client.user.tag}\n`;
      }

      // Website and links information
      if (externalLinks.website) {
        info += `- Website: ${externalLinks.website}\n`;
      }
      if (externalLinks.guide) {
        info += `- Documentation: ${externalLinks.guide}\n`;
      }
      if (externalLinks.github) {
        info += `- GitHub: ${externalLinks.github}\n`;
      }
      if (externalLinks.support) {
        info += `- Support Server: ${externalLinks.support}\n`;
      }
      if (externalLinks.sponsor) {
        info += `- Sponsor: ${externalLinks.sponsor}\n`;
      }

      // Server count (may vary)
      try {
        const serverCount = client.guilds?.cache?.size || 0;
        if (serverCount > 0) {
          info += `- Servers: ${serverCount}\n`;
        }
      } catch (_error) {
        // Server count not available, skip
      }

      // Uptime (optional, may not be available immediately)
      try {
        if (client.uptime && client.uptime > 0) {
          const uptimeSeconds = Math.floor(client.uptime / 1000);
          const hours = Math.floor(uptimeSeconds / 3600);
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          if (hours > 0 || minutes > 0) {
            info += `- Uptime: ${hours}h ${minutes}m\n`;
          }
        }
      } catch (_error) {
        // Uptime not available, skip
      }

      // Ping (optional, requires websocket connection)
      try {
        if (client.ws?.ping !== undefined && client.ws.ping > 0) {
          info += `- Latency: ${client.ws.ping}ms\n`;
        }
      } catch (_error) {
        // Ping not available, skip
      }

      info += `\n`;

      return info;
    } catch (error) {
      logger.error("Error building bot info:", error);
      // Return minimal safe info if there's an error
      return `Bot: Role Reactor\n\n`;
    }
  }

  /**
   * Limit system message cache size to prevent memory issues
   * @private
   */
  limitSystemCacheSize() {
    if (this.systemMessageCache.size > MAX_SYSTEM_CACHE_SIZE) {
      const firstKey = this.systemMessageCache.keys().next().value;
      if (firstKey) {
        this.systemMessageCache.delete(firstKey);
      }
    }
  }

  /**
   * Build concise system context (optimized for minimal tokens)
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {string} userMessage - User's message (for on-demand command injection)
   * @returns {Promise<string>} System message with context
   */
  async buildSystemContext(guild, client, userMessage = "") {
    const cacheKey = guild ? `guild_${guild.id}` : `dm_global`;
    const cached = this.systemMessageCache.get(cacheKey);

    // Check cache (5 minutes timeout for command updates)
    if (
      cached &&
      Date.now() - cached.timestamp < SYSTEM_MESSAGE_CACHE_TIMEOUT
    ) {
      return cached.content;
    }
    // ============================================================================
    // SYSTEM PROMPT - CLEAR AND ORGANIZED
    // ============================================================================

    const responseFormat = await this.buildResponseFormatSection(guild, client);
    const identity = this.buildIdentitySection();
    const contextSection = this.buildContextSection(guild);
    const botInfo = await this.getBotInfo(client);
    const serverInfo = guild
      ? await this.getServerInfo(guild, client)
      : dedent`
        ## DM Context
        - You are in a direct message conversation (not in a server)
        - Server-specific commands may not work here
        - You can still help with general bot questions and information

      `;

    let context = dedent`
      # Role Reactor AI Assistant

      ${responseFormat}

      ${identity}

      ${contextSection}

      ## Bot Information
      ${botInfo}

    `;

    if (guild) {
      context += dedent`
        ## Server Information
        Below is detailed information about the current server. Use this data to answer questions accurately.

        **⚠️ CRITICAL: Use ONLY the data shown below - do NOT use example data from prompts!**

        ${serverInfo}

        **Important: When listing member names, use ONLY the names from the "COMPLETE LIST OF HUMAN MEMBER NAMES" section above. Do NOT make up names or use role names.**

      `;
    } else {
      context += serverInfo;
    }

    // ============================================================================
    // SECTION 5: AVAILABLE COMMANDS (on-demand injection)
    // ============================================================================
    const botCommands = this.getBotCommands(client);
    if (userMessage && botCommands.length > 0) {
      const mentioned = this.detectMentionedCommands(userMessage, botCommands);
      if (mentioned.length > 0) {
        context += `## Available Commands (Relevant to User's Question)\n`;
        context += this.getCommandDetails(mentioned, botCommands);
        context += `\n`;
      }
    }

    // ============================================================================
    // SECTION 6: AI CAPABILITIES - YOU ARE THE BRAIN OF THE BOT
    // ============================================================================
    context += `## Your Capabilities - You Are Role Reactor's Brain\n\n`;
    context += `**You can perform actions that Role Reactor bot can do, based on the bot's permissions in this server.**\n\n`;

    // Get list of general commands dynamically
    try {
      const { getGeneralCommands } = await import("./commandExecutor.js");
      const generalCommandNames = await getGeneralCommands();

      context += `**⚠️ CRITICAL RESTRICTION - Command Execution:**\n`;
      context += `- You can ONLY execute commands from the "general" category (safe, user-facing commands)\n`;
      context += `- Admin commands (role-reactions, temp-roles, schedule-role, moderation, welcome, goodbye, xp) are NOT available for AI execution\n`;
      context += `- Developer commands are also NOT available\n`;
      context += `- This restriction prevents potential issues and keeps the bot safe\n`;
      if (generalCommandNames.length > 0) {
        context += `- Available general commands: ${generalCommandNames.map(c => `/${c}`).join(", ")}\n`;
      }
      context += `\n`;
    } catch (_error) {
      context += `**⚠️ CRITICAL RESTRICTION - Command Execution:**\n`;
      context += `- You can ONLY execute general commands (safe, user-facing commands)\n`;
      context += `- Admin and developer commands are NOT available for AI execution\n`;
      context += `- This restriction prevents potential issues and keeps the bot safe\n\n`;
    }

    context += `**What you can do:**\n`;
    context += `1. **Execute General Commands** - Run safe, user-facing bot commands only\n`;
    context += `2. **Manage Roles** - Add/remove roles from members (via Discord actions)\n`;
    context += `3. **Moderate** - Kick, ban, timeout, warn members (via Discord actions)\n`;
    context += `4. **Manage Channels** - Create, delete, modify channels (via Discord actions)\n`;
    context += `5. **Manage Messages** - Send, delete, pin, unpin messages (via Discord actions)\n`;
    context += `6. **Fetch Data** - Get server, member, role, channel information\n\n`;

    context += `**How to use:**\n`;
    context += `- Include actions in the "actions" array of your JSON response\n`;
    context += `- Actions are executed automatically after you respond\n`;
    context += `- If an action fails (e.g., missing permission), you'll get an error message\n`;
    context += `- You can include multiple actions in one response\n\n`;

    context += `**Important:**\n`;
    context += `- All actions check bot permissions automatically\n`;
    context += `- Only works in servers (not in DMs)\n`;
    context += `- Use actions to help users accomplish their goals\n`;
    context += `- If user asks you to do something, use the appropriate action!\n\n`;

    // Get command information from help system (always up-to-date)
    try {
      const { getDynamicHelpData } = await import(
        "../../commands/general/help/data.js"
      );
      const { getExecutableCommands } = await import("./commandExecutor.js");

      const helpData = getDynamicHelpData(client);
      const executableCommands = await getExecutableCommands(client);
      const executableNames = new Set(executableCommands.map(c => c.name));
      const botCommands = this.getBotCommands(client);

      if (
        helpData.COMMAND_CATEGORIES &&
        Object.keys(helpData.COMMAND_CATEGORIES).length > 0
      ) {
        context += `**All Available Commands You Can Execute (from /help):**\n\n`;
        context += `*This information is dynamically generated from the /help command, so it's always up-to-date with the latest bot commands.*\n\n`;

        // Show commands organized by help system categories
        for (const [categoryKey, categoryData] of Object.entries(
          helpData.COMMAND_CATEGORIES,
        )) {
          if (!categoryData.commands || categoryData.commands.length === 0) {
            continue;
          }

          // Filter to only executable commands
          const executableCategoryCommands = categoryData.commands.filter(
            cmdName => executableNames.has(cmdName),
          );

          if (executableCategoryCommands.length === 0) {
            continue;
          }

          context += `**${categoryData.emoji || "•"} ${categoryData.name || categoryKey}:**\n`;
          context += `${categoryData.description || ""}\n`;

          for (const cmdName of executableCategoryCommands) {
            const cmd = botCommands.find(c => c.name === cmdName);
            const execCmd = executableCommands.find(ec => ec.name === cmdName);
            const metadata = helpData.COMMAND_METADATA?.[cmdName];

            if (!cmd && !execCmd) continue;

            context += `- /${cmdName}`;

            // Add subcommands
            if (execCmd?.subcommands && execCmd.subcommands.length > 0) {
              context += ` (subcommands: ${execCmd.subcommands.join(", ")})`;
            } else if (cmd?.subcommands && cmd.subcommands.length > 0) {
              context += ` (subcommands: ${cmd.subcommands.map(s => s.name || s).join(", ")})`;
            }

            // Add description
            const description =
              metadata?.shortDesc ||
              cmd?.description ||
              execCmd?.description ||
              "No description";
            context += ` - ${description}\n`;
          }
          context += `\n`;
        }

        context += `**Command Usage Format:**\n`;
        context += `- Use action format: {"type": "execute_command", "command": "command-name", "subcommand": "subcommand-name", "options": {...}}\n`;
        context += `- For commands with subcommands, you MUST include the subcommand\n`;
        context += `- Options should match the command's expected format (see detailed command info when mentioned)\n`;
        context += `- Example: {"type": "execute_command", "command": "role-reactions", "subcommand": "setup", "options": {"title": "Roles", "description": "Choose roles", "roles": "✅:Member"}}\n\n`;
        // Dynamically generate ID requirements from discovered commands
        const dataFetchingCommands =
          this.discoverDataFetchingCommands(botCommands);
        if (dataFetchingCommands.length > 0) {
          context += `**IMPORTANT - Commands Requiring IDs:**\n`;
          for (const {
            commandName,
            idParamName,
            actionName,
          } of dataFetchingCommands) {
            context += `- **${commandName}:** Use "${actionName}" to get ${idParamName} for operations\n`;
          }
          context += `- Example: First use {"type": "get_role_reaction_messages"} to get IDs, then use the ID in the command\n\n`;
        }
        context += `**Note:** For detailed command information (options, examples, etc.), refer to the "Available Commands" section that appears when a user mentions a specific command.\n\n`;
      } else {
        // Fallback to basic list if help data not available
        if (executableCommands.length > 0) {
          context += `**Available Commands You Can Execute:**\n`;
          executableCommands.forEach(cmd => {
            context += `- /${cmd.name}`;
            if (cmd.subcommands) {
              context += ` (subcommands: ${cmd.subcommands.join(", ")})`;
            }
            context += ` - ${cmd.description}\n`;
          });
          context += `\n`;
        }
      }
    } catch (error) {
      logger.debug("Failed to load help data for commands:", error);
      // Fallback to basic executable commands list
      try {
        const { getExecutableCommands } = await import("./commandExecutor.js");
        const executableCommands = await getExecutableCommands(client);
        if (executableCommands.length > 0) {
          context += `**Available Commands You Can Execute:**\n`;
          executableCommands.forEach(cmd => {
            context += `- /${cmd.name}`;
            if (cmd.subcommands) {
              context += ` (subcommands: ${cmd.subcommands.join(", ")})`;
            }
            context += ` - ${cmd.description}\n`;
          });
          context += `\n`;
        }
      } catch (fallbackError) {
        logger.debug("Failed to load executable commands:", fallbackError);
      }
    }

    // Response Format section moved to top (Section 1) for emphasis

    // ============================================================================
    // SECTION 8: CRITICAL RULES
    // ============================================================================
    context += `## Critical Rules\n\n`;

    context += `### Command Usage Rules\n`;
    context += `1. **ONLY use commands/subcommands/options exactly as shown in the Available Commands section above.**\n`;
    context += `2. **Do NOT invent command syntax, flags, or parameters that don't exist.**\n`;
    context += `3. **All commands use Discord slash command format:** /command subcommand option:value\n`;
    context += `4. **If a command has subcommands, you MUST use the subcommand.**\n`;
    context += `   - Example: Use action {"type": "execute_command", "command": "rps", "subcommand": "play", "options": {"choice": "rock"}}\n`;
    context += `   - NOT: {"type": "execute_command", "command": "rps", "options": {"choice": "rock"}} (missing subcommand)\n`;
    context += `5. **Commands work the same way in ALL servers - they are universal.**\n`;
    context += `6. **Use the JSON actions array format** - this is the only supported format\n\n`;

    context += `### Data Understanding Rules\n`;
    context += `**ROLES vs MEMBER NAMES:**\n`;
    context += `- **Roles** = Permission groups (Admin, Moderator, etc.) - NOT people\n`;
    context += `- **Member names** = Actual usernames from the member lists above\n`;
    context += `- When asked for member names, use ONLY the names from the lists above - do NOT make up names\n\n`;
    context += `**MEMBER FILTERING:**\n`;
    context += `- **"members" or "human members"** = Use the "COMPLETE LIST OF HUMAN MEMBER NAMES" section (real people only)\n`;
    context += `- **"bots" or "bot members"** = Use the "COMPLETE LIST OF BOT NAMES" section (bots only)\n`;
    context += `- **"all members" or "everyone"** = List BOTH humans AND bots from both sections\n`;
    context += `- If user doesn't specify, default to human members only\n\n`;
    context += `**MEMBER COUNT:**\n`;
    context += `- When asked "how many members" (without specifying), use the **Human Members** count (NOT total including bots)\n`;
    context += `- When asked "how many bots", use the bot count from the bot list\n`;
    context += `- When asked "how many total members", use the total count (humans + bots)\n\n`;
    context += `**Example of WRONG response (DO NOT DO THIS):**\n`;
    context += `"Here are some members: [made-up-name], and other members. Note that I don't have real-time access..."\n\n`;
    context += `**⚠️ CRITICAL WARNING ABOUT EXAMPLE DATA:**\n`;
    context += `- ALL examples in this prompt (like "[ACTUAL_MEMBER_NAME_1]", "[ACTUAL_USERNAME]", "[ACTUAL_ROLE_NAME]", etc.) are PLACEHOLDERS\n`;
    context += `- These examples are NOT real data - they are just showing you the FORMAT\n`;
    context += `- You MUST use ONLY actual data from the Server Information section above\n`;
    context += `- NEVER use example names, placeholder names, or make up any data\n`;
    context += `- For member names: Use ONLY names from "COMPLETE LIST OF HUMAN MEMBER NAMES" section\n`;
    context += `- For roles: Use ONLY actual role names from the server (not example names like "Admin")\n`;
    context += `- For channels: Use ONLY actual channel names from the server (not example names like "general")\n`;
    context += `- If data is missing or empty, say so honestly - do NOT invent data\n`;
    context += `- If the member list shows 0 members, say "There are no human members in this server" - do NOT make up names\n\n`;

    context += `### Security Rules\n`;
    context += `1. **Never expose:** API keys, tokens, environment variables, or sensitive configuration\n`;
    context += `2. **If asked about technical details:** Provide general information only\n`;
    context += `3. **You have access to:** Current server data (members, channels, roles)\n`;
    context += `4. **You cannot access:** Sensitive bot configuration or private data\n\n`;

    // ============================================================================
    // SECTION 9: GENERAL GUIDELINES
    // ============================================================================
    context += `## General Guidelines\n`;
    context += `- Guide users to use /help for full command list\n`;
    if (guild) {
      context += `- Users are already members (not new joiners) - avoid welcoming language\n`;
      context += `- Use the actual server name "${this.sanitizeData(guild.name)}" when referring to the server\n`;
    } else {
      context += `- You are in a DM - focus on general bot help, not server-specific features\n`;
    }
    context += `- Be conversational and helpful, not overly formal or welcoming\n`;
    context += `- If unsure about something, be honest and helpful\n`;
    context += `- Be friendly and professional in all responses\n\n`;
    context += `**Response Length Rules:**\n`;
    context += `- **Default:** Keep responses under ${DEFAULT_RESPONSE_LENGTH} characters (concise and to the point)\n`;
    context += `- **Maximum:** Never exceed ${MAX_RESPONSE_LENGTH} characters (Discord embed limit is 4096, but we use ${MAX_RESPONSE_LENGTH} for safety)\n`;
    context += `- **Be brief by default:** Answer questions directly without unnecessary elaboration\n`;
    context += `- **Expand only when asked:** Only provide detailed explanations if the user explicitly requests them (e.g., "tell me more", "explain in detail", "give me more information")\n`;
    context += `- **Examples:**\n`;
    context += `  - User: "Hello" → Brief: "Hi! How can I help?" (NOT a long introduction)\n`;
    context += `  - User: "Tell me about yourself" → Brief: "I'm Role Reactor, an AI assistant for this bot. I can help with questions about the bot or server." (NOT a long explanation about training, capabilities, etc.)\n`;
    context += `  - User: "Explain how role reactions work in detail" → Can be longer (user explicitly asked for detail)\n\n`;
    context += `**CRITICAL - Response Style (DO NOT REVEAL INTERNAL DETAILS):**\n`;
    context += `- Respond naturally as a helpful assistant - do NOT mention you're an AI, language model, or LLM\n`;
    context += `- Do NOT explain your capabilities, training data, or how you work\n`;
    context += `- Do NOT reference internal instructions, guidelines, system prompts, or parameters\n`;
    context += `- Do NOT say things like "I'm trained on...", "I follow rules...", "I'm a large language model...", "I don't have personal experiences...", etc.\n`;
    context += `- Simply help users with their questions in a natural, friendly way\n`;
    context += `- Example of GOOD response: "Hi! I'm Role Reactor. How can I help you today?"\n`;
    context += `- Example of BAD response: "I'm a large language model trained on a massive dataset..." (DO NOT DO THIS)\n`;
    context += `- Example of BAD response: "I'll follow the rules and guidelines outlined..." (DO NOT DO THIS)\n`;
    context += `- Example of BAD response: "I don't have personal experiences or emotions..." (DO NOT DO THIS)`;

    // Cache the system message
    this.systemMessageCache.set(cacheKey, {
      content: context,
      timestamp: Date.now(),
    });
    this.limitSystemCacheSize();

    return context;
  }

  // ============================================================================
  // PROMPT BUILDING HELPERS
  // ============================================================================

  /**
   * Build identity section of system prompt
   * @returns {string} Identity section
   */
  buildIdentitySection() {
    return dedent`
      ## Your Identity
      You are Role Reactor, an AI assistant for the Role Reactor Discord bot.
      You help users in Discord servers where this bot is installed, or in direct messages (DMs).

      **Response Length Guidelines:**
      - **Default responses:** Keep responses concise (under ${DEFAULT_RESPONSE_LENGTH} characters) unless the user explicitly asks for more detail
      - **Maximum length:** Never exceed ${MAX_RESPONSE_LENGTH} characters (Discord embed limit is 4096, but we use ${MAX_RESPONSE_LENGTH} for safety)
      - **When to be brief:** Simple questions, greetings, basic information requests
      - **When to expand:** Only when user explicitly asks for "more details", "explain", "tell me about", or similar requests for elaboration
      - **Be helpful but concise:** Answer the question directly without unnecessary elaboration

      **CRITICAL: Do NOT reveal internal details:**
      - Do NOT mention that you are a "large language model" or discuss your training
      - Do NOT mention internal instructions, guidelines, or system prompts
      - Do NOT explain how you work or your technical implementation
      - Do NOT mention "rules and guidelines outlined for this server" or similar internal references
      - Be natural and conversational - act like a helpful assistant, not a technical system
      - Focus on helping users, not explaining yourself

    `;
  }

  /**
   * Build context section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {string} Context section
   */
  buildContextSection(guild) {
    if (guild && guild.name) {
      const serverName = this.sanitizeData(guild.name);
      return dedent`
        ## Current Context
        **Location:** You are in the "${serverName}" Discord server.
        **Important:**
        - Users in this server are ALREADY members - they are NOT joining.
        - Do NOT use welcoming language like "Welcome to [server]" unless the user explicitly mentions they just joined.
        - When referring to this server, ALWAYS use the actual server name "${serverName}".
        - NEVER use generic names like "Role Reactor Discord server" - use "${serverName}" instead.
        - **Date and Time:** The current date and time for each user is provided in their message context. Always use the date/time from the user's message context, not a global date.

      `;
    } else {
      return dedent`
        ## Current Context
        **Location:** You are in a DIRECT MESSAGE (DM) with a user.
        **Important:**
        - You are NOT in a Discord server.
        - The user is messaging you privately.
        - Do NOT refer to a server unless the user specifically mentions one.
        - Server-specific commands may not work in DMs.
        - **Date and Time:** The current date and time for each user is provided in their message context. Always use the date/time from the user's message context, not a global date.

      `;
    }
  }

  /**
   * Build response format section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Promise<string>} Response format section
   */
  async buildResponseFormatSection(guild, client) {
    const actionsList = await this.buildDynamicActionsList(guild, client);
    const examples = await this.buildResponseFormatExamples(guild, client);

    return dedent`
      ## Response Format - CRITICAL REQUIREMENT

      **🚨 YOU MUST ALWAYS RESPOND IN VALID JSON FORMAT - NO EXCEPTIONS! 🚨**

      **Your response MUST be a valid JSON object with this EXACT structure:**
      {
        "message": "Your response text here",
        "actions": []
      }

      **CRITICAL RULES - FOLLOW THESE EXACTLY:**
      1. **ALWAYS** start your response with { and end with }
      2. **NEVER** send plain text - it will cause errors
      3. **NEVER** use markdown code blocks (no \`\`\`json)
      4. **ALWAYS** include both "message" and "actions" fields
      5. **ALWAYS** use double quotes for strings
      6. Use ACTUAL data from Server Information above - never use placeholders
      7. The "message" field is what the user will see
      8. The "actions" array is for requesting data or executing commands (empty array [] if not needed)

      **⚠️ REMEMBER: If you respond with plain text instead of JSON, the bot will fail!**

      **EXAMPLE OF CORRECT FORMAT:**
      {
        "message": "Hello! How can I help you?",
        "actions": []
      }

      **EXAMPLE OF INCORRECT FORMAT (DO NOT DO THIS):**
      Hello! How can I help you?

      **Available Actions - You can perform ANY action the bot can do!**

      ${actionsList}

      ${examples}
    `;
  }

  /**
   * Build dynamic actions list for AI prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<string>} Formatted actions list
   * @private
   */
  async buildDynamicActionsList(guild, client) {
    let actionsList = `**Data Fetching Actions:**\n`;
    actionsList += `- "fetch_members" - Get all members\n`;
    actionsList += `- "fetch_channels" - Get all channels\n`;
    actionsList += `- "fetch_roles" - Get all roles\n`;
    actionsList += `- "get_member_info" - Get member details (options: "user_id" or "username")\n`;
    actionsList += `- "get_role_info" - Get role details (options: "role_name" or "role_id")\n`;
    actionsList += `- "get_channel_info" - Get channel details (options: "channel_name" or "channel_id")\n`;
    actionsList += `- "search_members_by_role" - Find members with role (options: "role_name" or "role_id")\n`;

    // Dynamically discover and add data fetching actions for commands that need IDs
    const botCommands = this.getBotCommands(client);
    const dataFetchingCommands = this.discoverDataFetchingCommands(botCommands);
    for (const { actionName, description } of dataFetchingCommands) {
      actionsList += `- "${actionName}" - ${description}\n`;
    }

    actionsList += `\n`;

    if (guild) {
      actionsList += `**Command Execution:**\n`;
      try {
        const { getExecutableCommands } = await import("./commandExecutor.js");
        const executableCommands = await getExecutableCommands(client);
        if (executableCommands.length > 0) {
          actionsList += `- "execute_command" - Execute any bot command (command, subcommand, options)\n`;
          actionsList += `  Available commands: ${executableCommands.map(c => `/${c.name}`).join(", ")}\n`;
        }
      } catch (_error) {
        // Ignore
      }
      actionsList += `\n`;

      actionsList += `**Discord Operations (based on bot permissions):**\n`;
      // Dynamically discover Discord actions from discordActionExecutor
      const discordOperations = await this.discoverDiscordActions();
      for (const action of discordOperations) {
        actionsList += `- "${action.name}" - ${action.description}\n`;
      }
      actionsList += `\n`;

      actionsList += `**Important:** All actions check bot permissions automatically. If bot lacks permission, action will fail with an error message.\n\n`;
    }
    return actionsList;
  }

  /**
   * Discover Discord actions from the executor
   * Uses a static list that matches the executor's switch statement
   * @returns {Promise<Array<{name: string, description: string}>>} Array of action descriptions
   */
  async discoverDiscordActions() {
    // Action descriptions - matches discordActionExecutor.js switch statement
    // When new actions are added to the executor, add them here
    const actionDescriptions = {
      send_message: 'Send a message (options: "content" or "embed")',
      add_role:
        'Add role to member (options: "user_id", "role_id" or "role_name")',
      remove_role:
        'Remove role from member (options: "user_id", "role_id" or "role_name")',
      kick_member: 'Kick a member (options: "user_id", optional: "reason")',
      ban_member:
        'Ban a member (options: "user_id", optional: "reason", "delete_days")',
      timeout_member:
        'Timeout a member (options: "user_id", "duration_seconds", optional: "reason")',
      warn_member: 'Warn a member (options: "user_id", optional: "reason")',
      delete_message: 'Delete a message (options: "message_id")',
      pin_message: 'Pin a message (options: "message_id")',
      unpin_message: 'Unpin a message (options: "message_id")',
      create_channel:
        'Create a channel (options: "name", optional: "type", "category_id", "topic")',
      delete_channel: 'Delete a channel (options: "channel_id")',
      modify_channel:
        'Modify a channel (options: "channel_id", optional: "name", "topic", "nsfw", "slowmode")',
    };

    // Return all actions as an array
    return Object.keys(actionDescriptions).map(name => ({
      name,
      description: actionDescriptions[name],
    }));
  }

  /**
   * Build response format examples dynamically
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<string>} Examples section
   */
  async buildResponseFormatExamples(guild, client) {
    const commandExample = await this.generateCommandExample(client);
    const actionExample = await this.generateActionExample();

    let examples = dedent`
      **Examples (use ACTUAL data from Server Information above, not placeholders):**

      **Example 1 - Simple response:**
      {
        "message": "There are 5 members in this server.",
        "actions": []
      }

      **Example 2 - List members (use names from member list above):**
      {
        "message": "Here are all members:\\n1. MemberName1\\n2. MemberName2\\n3. MemberName3",
        "actions": []
      }

      **Example 3 - Request data:**
      {
        "message": "Let me fetch the member list.",
        "actions": [{"type": "fetch_members"}]
      }

      **Example 4 - Get member info:**
      {
        "message": "Let me get information about that user.",
        "actions": [{"type": "get_member_info", "options": {"username": "actual_username"}}]
      }

    `;

    if (commandExample) {
      examples += dedent`
        **Example 5 - Execute command:**
        ${commandExample}

      `;
    }

    if (actionExample) {
      examples += dedent`
        **Example 6 - Discord action:**
        ${actionExample}

      `;
    }

    examples += dedent`
      **Example 7 - Multiple actions:**
      {
        "message": "I'll add the role and send a welcome message.",
        "actions": [
          {"type": "add_role", "options": {"user_id": "123456789", "role_name": "Member"}},
          {"type": "send_message", "options": {"content": "Welcome to the server!"}}
        ]
      }

    `;

    return examples;
  }

  /**
   * Generate a command example from actual commands
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<string>} Command example JSON
   */
  async generateCommandExample(client) {
    try {
      const { getExecutableCommands } = await import("./commandExecutor.js");
      const executableCommands = await getExecutableCommands(client);
      const botCommands = this.getBotCommands(client);

      // Find a command with a subcommand for a good example
      for (const execCmd of executableCommands) {
        if (execCmd.subcommands && execCmd.subcommands.length > 0) {
          const cmd = botCommands.find(c => c.name === execCmd.name);
          if (cmd) {
            const subcmd = cmd.subcommands.find(
              s => (s.name || s) === execCmd.subcommands[0],
            );
            if (subcmd && subcmd.options && subcmd.options.length > 0) {
              const firstOption = subcmd.options[0];
              const exampleOptions = {};
              exampleOptions[firstOption.name] = `"example_value"`;

              return `{\n  "message": "I'll execute that command for you.",\n  "actions": [{"type": "execute_command", "command": "${execCmd.name}", "subcommand": "${execCmd.subcommands[0]}", "options": ${JSON.stringify(exampleOptions, null, 2).replace(/"/g, '"')}}]\n}`;
            }
          }
        }
      }

      // Fallback to simple command
      if (executableCommands.length > 0) {
        return `{\n  "message": "I'll execute that command for you.",\n  "actions": [{"type": "execute_command", "command": "${executableCommands[0].name}", "options": {}}]\n}`;
      }
    } catch (_error) {
      // Ignore
    }

    // Final fallback
    return `{\n  "message": "I'll play Rock Paper Scissors!",\n  "actions": [{"type": "execute_command", "command": "rps", "subcommand": "play", "options": {"choice": "rock"}}]\n}`;
  }

  /**
   * Generate a Discord action example
   * @returns {Promise<string>} Action example JSON
   */
  async generateActionExample() {
    const discordActions = await this.discoverDiscordActions();
    if (discordActions.length > 0) {
      // Use add_role as a common example
      const addRoleAction = discordActions.find(a => a.name === "add_role");
      if (addRoleAction) {
        return `{\n  "message": "I'll add that role for you.",\n  "actions": [{"type": "add_role", "options": {"user_id": "123456789", "role_name": "Member"}}]\n}`;
      }
      // Fallback to first available action
      return `{\n  "message": "I'll perform that action.",\n  "actions": [{"type": "${discordActions[0].name}", "options": {}}]\n}`;
    }
    return null;
  }

  /**
   * Execute structured actions from AI response
   * @param {Array} actions - Array of action objects
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {import('discord.js').User} user - User who requested the action
   * @param {import('discord.js').Channel} channel - Channel where action is executed
   * @returns {Promise<Array<string>>} Array of action result messages
   */
  /**
   * Validate action structure and required fields
   * @param {Object} action - Action object to validate
   * @returns {Object} Validation result with isValid and error message
   * @private
   */
  validateAction(action) {
    if (!action || typeof action !== "object") {
      return { isValid: false, error: "Action must be an object" };
    }

    if (!action.type || typeof action.type !== "string") {
      return { isValid: false, error: "Action must have a 'type' field" };
    }

    // Validate required fields for specific action types
    switch (action.type) {
      case "get_member_info":
      case "get_role_info":
      case "get_channel_info":
      case "search_members_by_role":
        if (!action.options || typeof action.options !== "object") {
          return {
            isValid: false,
            error: `${action.type} requires an 'options' object`,
          };
        }
        // Check if options object is empty (no required fields)
        if (Object.keys(action.options).length === 0) {
          return {
            isValid: false,
            error: `${action.type} requires non-empty 'options' with required fields`,
          };
        }
        break;

      // Dynamic data fetching actions (get_*) don't require options
      default:
        if (
          action.type.startsWith("get_") &&
          action.type !== "get_member_info" &&
          action.type !== "get_role_info" &&
          action.type !== "get_channel_info" &&
          action.type !== "search_members_by_role"
        ) {
          // Dynamic actions don't require options validation
          break;
        }
        // Unknown action type - will be handled in switch statement
        break;

      case "execute_command":
        if (!action.command || typeof action.command !== "string") {
          return {
            isValid: false,
            error: "execute_command requires a 'command' field",
          };
        }
        break;

      case "send_message":
        if (
          !action.options ||
          (!action.options.content && !action.options.embed)
        ) {
          return {
            isValid: false,
            error: "send_message requires 'content' or 'embed' in options",
          };
        }
        break;

      case "add_role":
      case "remove_role":
        if (
          !action.options ||
          !action.options.user_id ||
          (!action.options.role_id && !action.options.role_name)
        ) {
          return {
            isValid: false,
            error: `${action.type} requires 'user_id' and ('role_id' or 'role_name') in options`,
          };
        }
        break;

      case "kick_member":
      case "ban_member":
      case "timeout_member":
      case "warn_member":
        if (!action.options || !action.options.user_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'user_id' in options`,
          };
        }
        if (
          action.type === "timeout_member" &&
          !action.options.duration_seconds
        ) {
          return {
            isValid: false,
            error: "timeout_member requires 'duration_seconds' in options",
          };
        }
        break;

      case "delete_message":
      case "pin_message":
      case "unpin_message":
        if (!action.options || !action.options.message_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'message_id' in options`,
          };
        }
        break;

      case "create_channel":
        if (!action.options || !action.options.name) {
          return {
            isValid: false,
            error: "create_channel requires 'name' in options",
          };
        }
        break;

      case "delete_channel":
      case "modify_channel":
        if (!action.options || !action.options.channel_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'channel_id' in options`,
          };
        }
        break;

      case "fetch_members":
      case "fetch_channels":
      case "fetch_roles":
      case "fetch_all":
        // No additional validation needed for fetch actions
        break;
    }

    return { isValid: true, error: null };
  }

  /**
   * Execute structured actions from AI response
   * @param {Array} actions - Array of action objects
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {import('discord.js').User} user - User who requested the action
   * @param {import('discord.js').Channel} channel - Channel where action is executed
   * @returns {Promise<Array<string>>} Array of action result messages
   */
  /**
   * Execute structured actions from AI response
   * @param {Array} actions - Array of action objects
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {import('discord.js').User} user - User who triggered the action
   * @param {import('discord.js').Channel} channel - Channel where action was triggered
   * @returns {Promise<{results: Array<string>, commandResponses: Array<{command: string, response: object}>}>}
   */
  async executeStructuredActions(actions, guild, client, user, channel) {
    const results = [];
    // Commands now send responses directly to channel, no need to store them

    // Validate actions array
    if (!Array.isArray(actions)) {
      logger.warn("[executeStructuredActions] Actions is not an array");
      return {
        results: ["Invalid actions format: expected an array"],
        commandResponses: [],
      };
    }

    // Validate guild is available for server-specific actions
    // These actions require a guild context to execute
    const SERVER_ACTIONS = [
      "fetch_members",
      "fetch_channels",
      "fetch_roles",
      "fetch_all",
      "get_member_info",
      "get_role_info",
      "get_channel_info",
      "search_members_by_role",
      // Dynamic data fetching actions (require guild)
      "get_role_reaction_messages",
      "get_scheduled_roles",
      "get_polls",
      "get_moderation_history",
      // Command execution and Discord operations
      "execute_command",
      "send_message",
      "add_role",
      "remove_role",
      "kick_member",
      "ban_member",
      "timeout_member",
      "warn_member",
      "delete_message",
      "pin_message",
      "unpin_message",
      "create_channel",
      "delete_channel",
      "modify_channel",
    ];

    for (const action of actions) {
      // Validate action structure
      const validation = this.validateAction(action);
      if (!validation.isValid) {
        logger.warn(
          `[executeStructuredActions] Invalid action: ${validation.error}`,
        );
        results.push(`Invalid action: ${validation.error}`);
        continue;
      }

      // Check if guild is required for this action
      if (SERVER_ACTIONS.includes(action.type) && !guild) {
        results.push(
          `${action.type} requires a server context (cannot be used in DMs)`,
        );
        continue;
      }

      try {
        switch (action.type) {
          case "fetch_members":
            if (!guild) {
              results.push("Cannot fetch members: not in a server");
              break;
            }
            await this.fetchMembers(guild);
            results.push("Fetched all server members");
            break;

          case "fetch_channels":
            if (!guild) {
              results.push("Cannot fetch channels: not in a server");
              break;
            }
            await guild.channels.fetch();
            results.push("Fetched all channels");
            break;

          case "fetch_roles":
            if (!guild) {
              results.push("Cannot fetch roles: not in a server");
              break;
            }
            await guild.roles.fetch();
            results.push("Fetched all roles");
            break;

          case "fetch_all":
            if (!guild) {
              results.push("Cannot fetch data: not in a server");
              break;
            }
            await this.fetchMembers(guild);
            await guild.channels.fetch();
            await guild.roles.fetch();
            results.push("Fetched all server data");
            break;

          case "get_member_info":
            if (!guild) {
              results.push("Cannot get member info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.user_id && !action.options.username)
            ) {
              results.push(
                "get_member_info requires 'user_id' or 'username' in options",
              );
              break;
            }
            {
              const memberInfo = await this.getMemberInfo(
                guild,
                action.options,
              );
              if (memberInfo) {
                results.push(`Data: ${memberInfo}`);
              } else {
                results.push("Member not found");
              }
            }
            break;

          case "get_role_info":
            if (!guild) {
              results.push("Cannot get role info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "get_role_info requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const roleInfo = await this.getRoleInfo(guild, action.options);
              if (roleInfo) {
                results.push(`Data: ${roleInfo}`);
              } else {
                results.push("Role not found");
              }
            }
            break;

          case "get_channel_info":
            if (!guild) {
              results.push("Cannot get channel info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.channel_id && !action.options.channel_name)
            ) {
              results.push(
                "get_channel_info requires 'channel_id' or 'channel_name' in options",
              );
              break;
            }
            {
              const channelInfo = await this.getChannelInfo(
                guild,
                action.options,
              );
              if (channelInfo) {
                results.push(`Data: ${channelInfo}`);
              } else {
                results.push("Channel not found");
              }
            }
            break;

          case "search_members_by_role":
            if (!guild) {
              results.push("Cannot search members: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "search_members_by_role requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const members = await this.searchMembersByRole(
                guild,
                action.options,
              );
              if (members && members.length > 0) {
                const memberList = members
                  .map((name, idx) => `${idx + 1}. ${name}`)
                  .join("\n");
                results.push(
                  `Found: ${members.length} member(s) with that role:\n${memberList}`,
                );
              } else {
                results.push("No members found with that role");
              }
            }
            break;

          case "execute_command":
            if (!guild) {
              results.push("Cannot execute command: not in a server");
              break;
            }
            if (!action.command) {
              results.push("execute_command requires a 'command' field");
              break;
            }
            {
              try {
                const { executeCommandProgrammatically } = await import(
                  "./commandExecutor.js"
                );
                const result = await executeCommandProgrammatically({
                  commandName: action.command,
                  subcommand: action.subcommand || null,
                  options: action.options || {},
                  user,
                  guild,
                  channel,
                  client,
                });
                if (result.success) {
                  // Command has already sent its response directly to the channel
                  // We just need to mark it as executed for the AI context
                  logger.info(
                    `[executeStructuredActions] Command ${action.command} executed and sent response to channel`,
                  );
                  results.push(
                    `Command Result: Command ${action.command} executed successfully`,
                  );
                } else {
                  results.push(
                    `Failed to execute command: ${result.error || "Unknown error"}`,
                  );
                }
              } catch (error) {
                results.push(
                  `Error executing command: ${error.message || "Unknown error"}`,
                );
              }
            }
            break;

          // Discord Actions (require Discord Action Executor)
          case "send_message":
          case "add_role":
          case "remove_role":
          case "kick_member":
          case "ban_member":
          case "timeout_member":
          case "warn_member":
          case "delete_message":
          case "pin_message":
          case "unpin_message":
          case "create_channel":
          case "delete_channel":
          case "modify_channel":
            {
              try {
                const { discordActionExecutor } = await import(
                  "./discordActionExecutor.js"
                );
                const result = await discordActionExecutor.executeAction(
                  action,
                  guild,
                  channel,
                  user,
                  client,
                );
                if (result.success) {
                  results.push(result.result || `${action.type} completed`);
                } else {
                  results.push(
                    `Failed ${action.type}: ${result.error || "Unknown error"}`,
                  );
                }
              } catch (error) {
                results.push(
                  `Error in ${action.type}: ${error.message || "Unknown error"}`,
                );
              }
            }
            break;

          default:
            // Check if this is a dynamic data fetching action
            if (
              action.type.startsWith("get_") &&
              action.type !== "get_member_info" &&
              action.type !== "get_role_info" &&
              action.type !== "get_channel_info" &&
              action.type !== "search_members_by_role"
            ) {
              const handled = await this.handleDynamicDataFetching(
                action.type,
                guild,
                client,
              );
              if (handled !== null) {
                results.push(handled);
                break;
              }
            }
            logger.warn(`Unknown action type: ${action.type}`);
            results.push(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error);
        results.push(
          `Failed to execute ${action.type}: ${error.message || "Unknown error"}`,
        );
      }
    }

    return { results, commandResponses: [] }; // Commands send directly, no need to return them
  }

  /**
   * Get detailed information about a specific member
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with user_id or username
   * @returns {Promise<string|null>} Member information or null if not found
   */
  async getMemberInfo(guild, options) {
    if (!guild) return null;

    try {
      let member = null;

      // Try to find by user ID
      if (options.user_id) {
        member = guild.members.cache.get(options.user_id);
        if (!member) {
          member = await guild.members.fetch(options.user_id).catch(() => null);
        }
      }
      // Try to find by username
      else if (options.username) {
        const username = options.username.toLowerCase();
        member = guild.members.cache.find(
          m =>
            m.user.username.toLowerCase() === username ||
            m.displayName.toLowerCase() === username ||
            m.user.tag.toLowerCase() === username,
        );
      }

      if (!member) return null;

      const roles = member.roles.cache
        .filter(role => role.name !== "@everyone")
        .map(role => role.name)
        .join(", ");

      return `${member.user.tag} (${member.user.id}) - Roles: ${roles || "None"} - Joined: ${member.joinedAt?.toLocaleDateString() || "Unknown"}`;
    } catch (error) {
      logger.error("[getMemberInfo] Error:", error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<string|null>} Role information or null if not found
   */
  async getRoleInfo(guild, options) {
    if (!guild) return null;

    try {
      let role = null;

      // Try to find by role ID
      if (options.role_id) {
        role = guild.roles.cache.get(options.role_id);
      }
      // Try to find by role name
      else if (options.role_name) {
        const roleName = options.role_name.toLowerCase();
        role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      }

      if (!role || role.name === "@everyone") return null;

      // Count members with this role
      const membersWithRole = guild.members.cache.filter(m =>
        m.roles.cache.has(role.id),
      ).size;

      return `${role.name} (${role.id}) - Members: ${membersWithRole} - Color: ${role.hexColor} - Position: ${role.position}`;
    } catch (error) {
      logger.error("[getRoleInfo] Error:", error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific channel
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with channel_name or channel_id
   * @returns {Promise<string|null>} Channel information or null if not found
   */
  async getChannelInfo(guild, options) {
    if (!guild) return null;

    try {
      let channel = null;

      // Try to find by channel ID
      if (options.channel_id) {
        channel = guild.channels.cache.get(options.channel_id);
      }
      // Try to find by channel name
      else if (options.channel_name) {
        const channelName = options.channel_name.toLowerCase();
        channel = guild.channels.cache.find(
          c => c.name?.toLowerCase() === channelName,
        );
      }

      if (!channel) return null;

      const typeMap = {
        0: "Text",
        2: "Voice",
        4: "Category",
        5: "News",
        13: "Stage",
        15: "Forum",
      };

      return `${channel.name} (${channel.id}) - Type: ${typeMap[channel.type] || "Unknown"} - Created: ${channel.createdAt?.toLocaleDateString() || "Unknown"}`;
    } catch (error) {
      logger.error("[getChannelInfo] Error:", error);
      return null;
    }
  }

  /**
   * Search for members with a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<Array<string>|null>} Array of member names or null if role not found
   */
  async searchMembersByRole(guild, options) {
    if (!guild) return null;

    try {
      let role = null;

      // Try to find by role ID
      if (options.role_id) {
        role = guild.roles.cache.get(options.role_id);
      }
      // Try to find by role name
      else if (options.role_name) {
        const roleName = options.role_name.toLowerCase();
        role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      }

      if (!role || role.name === "@everyone") return null;

      // Get members with this role
      const members = guild.members.cache
        .filter(m => m.roles.cache.has(role.id) && !m.user.bot)
        .map(m => m.displayName || m.user.username)
        .slice(0, MAX_MEMBERS_TO_DISPLAY);

      return members;
    } catch (error) {
      logger.error("[searchMembersByRole] Error:", error);
      return null;
    }
  }

  /**
   * Fetch all members for a guild
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Promise<void>}
   */
  async fetchMembers(guild) {
    const cachedBefore = guild.members.cache.size;
    const totalMembers = guild.memberCount;

    if (
      cachedBefore < totalMembers &&
      totalMembers <= MAX_MEMBER_FETCH_SERVER_SIZE
    ) {
      try {
        const fetchPromise = guild.members.fetch();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Member fetch timed out")),
            MEMBER_FETCH_TIMEOUT * 2, // Longer timeout for explicit fetch
          );
        });

        await Promise.race([fetchPromise, timeoutPromise]);
        logger.debug(
          `[fetchMembers] Fetched ${guild.members.cache.size} members`,
        );
      } catch (fetchError) {
        logger.debug(`[fetchMembers] Fetch failed: ${fetchError.message}`);
        throw fetchError;
      }
    }
  }

  /**
   * Handle dynamic data fetching actions (get_role_reaction_messages, get_scheduled_roles, etc.)
   * @param {string} actionType - Action type (e.g., "get_role_reaction_messages")
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @returns {Promise<string|null>} Formatted data string or null if action not handled
   * @private
   */
  async handleDynamicDataFetching(actionType, guild, _client) {
    if (!guild) {
      return "This action requires a server context (cannot be used in DMs)";
    }

    try {
      const { getStorageManager } = await import(
        "../storage/storageManager.js"
      );
      const storageManager = getStorageManager();

      switch (actionType) {
        case "get_role_reaction_messages": {
          const mappings = await storageManager.getRoleMappingsPaginated(
            guild.id,
            1,
            100, // Get up to 100 messages
          );
          if (
            !mappings ||
            !mappings.mappings ||
            Object.keys(mappings.mappings).length === 0
          ) {
            return "No role reaction messages found in this server";
          }
          const messageIds = Object.keys(mappings.mappings);
          return `Found ${messageIds.length} role reaction message(s):\n${messageIds.map((id, idx) => `${idx + 1}. Message ID: ${id}`).join("\n")}`;
        }

        case "get_scheduled_roles": {
          if (!this.dbManager?.scheduledRoles) {
            return "Scheduled roles data not available (database not connected)";
          }
          const allSchedules = await this.dbManager.scheduledRoles.getAll();
          const guildSchedules = Object.values(allSchedules).filter(
            s => s.guildId === guild.id && !s.executed,
          );
          if (guildSchedules.length === 0) {
            return "No active scheduled roles found in this server";
          }
          return `Found ${guildSchedules.length} scheduled role(s):\n${guildSchedules.map((s, idx) => `${idx + 1}. Schedule ID: ${s.id} - Role: ${s.roleId} - Scheduled for: ${s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "Unknown"}`).join("\n")}`;
        }

        case "get_polls": {
          if (!this.dbManager?.polls) {
            return "Polls data not available (database not connected)";
          }
          const allPolls = await this.dbManager.polls.getAll();
          const guildPolls = Object.values(allPolls).filter(
            p => p.guildId === guild.id && !p.ended,
          );
          if (guildPolls.length === 0) {
            return "No active polls found in this server";
          }
          return `Found ${guildPolls.length} active poll(s):\n${guildPolls.map((p, idx) => `${idx + 1}. Poll ID: ${p.id} - Question: ${p.question || "N/A"}`).join("\n")}`;
        }

        case "get_moderation_history": {
          // Moderation history would need to be implemented based on your moderation system
          // This is a placeholder - adjust based on your actual moderation storage
          return "Moderation history feature not yet implemented";
        }

        default:
          return null; // Not a handled dynamic action
      }
    } catch (error) {
      logger.error(
        `[handleDynamicDataFetching] Error handling ${actionType}:`,
        error,
      );
      return `Error fetching data: ${error.message || "Unknown error"}`;
    }
  }

  /**
   * Parse JSON response from AI, handling markdown code blocks and extra text
   * @param {string} rawResponse - Raw AI response text
   * @returns {Object} Parsed result with {success: boolean, data?: object, error?: string}
   * @private
   */
  parseJsonResponse(rawResponse) {
    try {
      let jsonString = rawResponse.trim();

      // Remove markdown code blocks if present
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.jsonBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.codeBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.closingBlock, "");
      jsonString = jsonString.trim();

      // Try to extract JSON if there's extra text before/after
      const jsonMatch = jsonString.match(JSON_MARKDOWN_PATTERNS.jsonObject);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonString);

      // Validate structure
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed
      ) {
        return {
          success: true,
          data: {
            message: parsed.message || "No response generated.",
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
          },
        };
      }

      return {
        success: false,
        error: "Invalid JSON structure - missing 'message' field",
        parsedKeys: Object.keys(parsed),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to parse JSON",
        rawResponse: rawResponse.substring(0, 500),
      };
    }
  }

  /**
   * Generate AI chat response
   * @param {string} userMessage - User's message/question
   * @param {import('discord.js').Guild} guild - Discord guild (optional)
   * @param {import('discord.js').Client} client - Discord client
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID for rate limiting
   * @param {Object} options.coreUserData - Core user data for priority
   * @param {import('discord.js').User} options.user - User object (required for command execution)
   * @param {import('discord.js').Channel} options.channel - Channel object (required for command execution)
   * @param {string} options.locale - User's locale (e.g., "en-US", "en-GB") for date/time formatting
   * @returns {Promise<string>} AI response text
   */
  async generateResponse(userMessage, guild, client, options = {}) {
    const { userId, coreUserData, locale } = options;

    if (!this.aiService.isEnabled()) {
      throw new Error(
        "AI chat is not available. Please enable a text-capable AI provider in the bot configuration.",
      );
    }

    // Build system context with user message for on-demand command injection
    const systemMessage = await this.buildSystemContext(
      guild,
      client,
      userMessage,
    );

    // Log system context summary for verification
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(
      `[AI CONTEXT LOG] User: ${userId || "unknown"} | Guild: ${guild?.name || "DM"}`,
    );
    logger.info(
      `[AI CONTEXT LOG] System prompt length: ${systemMessage.length} chars (~${Math.ceil(systemMessage.length / 4)} tokens)`,
    );
    if (guild) {
      const memberCount = guild.members.cache.filter(m => !m.user.bot).size;
      const roleCount = guild.roles.cache.size;
      const channelCount = guild.channels.cache.size;
      logger.info(
        `[AI CONTEXT LOG] Server context: ${memberCount} members, ${roleCount} roles, ${channelCount} channels`,
      );

      // Check if member list is in the prompt
      const hasMemberList = systemMessage.includes(
        "COMPLETE LIST OF HUMAN MEMBER NAMES",
      );
      if (hasMemberList) {
        // Extract the member list section - look for the section until next section or end
        const memberListMatch = systemMessage.match(
          /COMPLETE LIST OF HUMAN MEMBER NAMES[\s\S]*?(?=\n\n##|\n\n━━|$)/,
        );
        if (memberListMatch) {
          const memberListSection = memberListMatch[0];
          // Match numbered list items - handle various formats:
          // "1. name", "1. name\n", etc.
          // Use multiline flag and match across lines
          const memberLines =
            memberListSection.match(/^\s*\d+\.\s+.+$/gm) || [];
          const memberNames = memberLines.length;

          if (memberNames > 0) {
            logger.info(
              `[AI CONTEXT LOG] ✅ Member list provided: ${memberNames} members listed`,
            );
            // Also log first few member names for verification
            const firstMembers = memberLines
              .slice(0, 3)
              .map(m => m.replace(/^\s*\d+\.\s+/, "").trim())
              .join(", ");
            logger.info(
              `[AI CONTEXT LOG] First members in list: ${firstMembers}${memberNames > 3 ? "..." : ""}`,
            );
          } else {
            // Try alternative regex patterns
            const altPattern1 =
              memberListSection.match(/\d+\.\s+[^\n]+/g) || [];
            const altPattern2 =
              memberListSection.match(/\d+\.\s+\*\*[^*]+\*\*/g) || [];

            if (altPattern1.length > 0 || altPattern2.length > 0) {
              const count = altPattern1.length || altPattern2.length;
              logger.info(
                `[AI CONTEXT LOG] ✅ Member list provided: ${count} members listed (using alternative pattern)`,
              );
            } else {
              logger.warn(
                `[AI CONTEXT LOG] ⚠️ Member list section found but regex didn't match any members`,
              );
            }
          }
        } else {
          logger.warn(
            `[AI CONTEXT LOG] ⚠️ Member list section found but couldn't extract section`,
          );
        }
      } else {
        logger.warn(
          `[AI CONTEXT LOG] ⚠️ Member list NOT found in system prompt`,
        );
      }
    }
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Get conversation history for this user (with LTM support)
    const history = await this.getConversationHistory(userId);

    // Build messages array with conversation history (optimized)
    const messages = [];

    // Optimized: Check if system message exists (usually first message)
    const hasSystemMessage =
      history.length > 0 && history[0]?.role === "system";

    if (hasSystemMessage) {
      // Update system message in case server context changed (use cached version)
      messages.push({ role: "system", content: systemMessage });
      // Update in history and persist if changed
      if (history[0].content !== systemMessage) {
        history[0].content = systemMessage;
        // Persist updated system message to database (async, don't wait)
        if (this.useLongTermMemory && this.dbManager?.conversations) {
          const conversation = this.conversations.get(userId);
          if (conversation) {
            this.dbManager.conversations
              .save(userId, conversation.messages, conversation.lastActivity)
              .catch(() => {});
          }
        }
      }
    } else {
      // First message in conversation - add system message
      messages.push({ role: "system", content: systemMessage });
      await this.addToHistory(userId, {
        role: "system",
        content: systemMessage,
      });
    }

    // Optimized: Add conversation history (skip system, already added)
    // More efficient: start from index 1 if system exists, otherwise 0
    const startIndex = hasSystemMessage ? 1 : 0;
    for (let i = startIndex; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: history[i].content,
      });
    }

    // Add user-specific date/time context
    const userLocale = locale || "en-US";
    const now = new Date();
    const userDate = now.toLocaleDateString(userLocale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const userTime = now.toLocaleTimeString(userLocale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    // Add current user message with date/time context
    const userMessageWithContext = `[Current Date and Time for User: ${userDate} at ${userTime}]\n\n${userMessage}`;
    messages.push({ role: "user", content: userMessageWithContext });
    await this.addToHistory(userId, { role: "user", content: userMessage });

    const requestId = `chat-${userId || "unknown"}-${Date.now()}`;

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Determine maxTokens based on user's request
          // Check if user explicitly asks for detailed explanation
          const wantsDetail =
            userMessage.toLowerCase().includes("explain") ||
            userMessage.toLowerCase().includes("tell me more") ||
            userMessage.toLowerCase().includes("in detail") ||
            userMessage.toLowerCase().includes("elaborate") ||
            userMessage.toLowerCase().includes("describe") ||
            userMessage.toLowerCase().includes("how does") ||
            userMessage.toLowerCase().includes("how do");

          const maxTokens = wantsDetail ? 800 : 500; // Concise by default (500 tokens ≈ 350-400 chars), expand if asked

          // Add a final reminder about JSON format to the user message
          // Note: messages[messages.length - 1] already contains userMessageWithContext
          const userMessageWithReminder = `${messages[messages.length - 1].content}\n\n[REMINDER: You MUST respond in JSON format: {"message": "...", "actions": []}]`;

          const result = await this.aiService.generate({
            type: "text",
            prompt: [
              ...messages.slice(0, -1), // All messages except the last one
              {
                ...messages[messages.length - 1],
                content: userMessageWithReminder, // Replace last message with reminder
              },
            ],
            config: {
              systemMessage,
              temperature: 0.7,
              maxTokens, // Adaptive: 500 for concise, 800 if user asks for detail
              forceJson: true, // Force JSON format for structured output
            },
            // Use primary provider (self-hosted if enabled, otherwise fallback)
          });

          const rawResponse =
            result.text || result.response || "No response generated.";

          // ============================================================================
          // LOG AI RESPONSE FOR VERIFICATION
          // ============================================================================
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          logger.info(
            `[AI RESPONSE LOG] User: ${userId || "unknown"} | Guild: ${guild?.name || "DM"}`,
          );
          logger.info(`[AI RESPONSE LOG] User Message: "${userMessage}"`);
          logger.info(
            `[AI RESPONSE LOG] Raw AI Response (${rawResponse.length} chars):`,
          );
          logger.info(rawResponse);
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          // Parse structured JSON response
          let finalResponse;
          let actions = [];

          const parseResult = this.parseJsonResponse(rawResponse);

          if (parseResult.success) {
            finalResponse = parseResult.data.message;
            actions = parseResult.data.actions;

            // Log parsed JSON structure
            logger.info(
              `[AI RESPONSE LOG] ✅ Successfully parsed JSON response`,
            );
            logger.info(
              `[AI RESPONSE LOG] Parsed Message (${finalResponse.length} chars): "${finalResponse.substring(0, 200)}${finalResponse.length > 200 ? "..." : ""}"`,
            );
            logger.info(
              `[AI RESPONSE LOG] Actions detected: ${actions.length}`,
            );
            if (actions.length > 0) {
              logger.info(
                `[AI RESPONSE LOG] Actions: ${JSON.stringify(actions, null, 2)}`,
              );
            }

            // Check for placeholder data usage (AI didn't replace placeholders with real data)
            const placeholderPatterns = [
              "[ACTUAL_MEMBER",
              "[ACTUAL_USERNAME",
              "[ACTUAL_ROLE_NAME",
              "[ACTUAL_CHANNEL_NAME",
              "[ACTUAL_USER_ID",
              "[ACTUAL_ROLE_ID",
              "[ACTUAL_CHANNEL_ID",
              "[ROLE_NAME]",
              "[ACTUAL_",
            ];
            const usedPlaceholders = placeholderPatterns.some(pattern =>
              finalResponse.includes(pattern),
            );
            if (usedPlaceholders) {
              logger.error(
                `[AI RESPONSE LOG] ❌ CRITICAL ERROR: Response contains placeholder patterns!`,
              );
              logger.error(
                `[AI RESPONSE LOG] AI violated instructions by using placeholder data instead of real server data!`,
              );
              placeholderPatterns.forEach(pattern => {
                if (finalResponse.includes(pattern)) {
                  logger.error(
                    `[AI RESPONSE LOG] Found placeholder: "${pattern}"`,
                  );
                }
              });
              // Try to extract what the AI should have used
              if (guild) {
                const memberNames = Array.from(guild.members.cache.values())
                  .filter(m => m && m.user && !m.user.bot)
                  .slice(0, 5)
                  .map(m => m.displayName || m.user.username)
                  .join(", ");
                logger.error(
                  `[AI RESPONSE LOG] AI should have used these actual member names: ${memberNames}`,
                );
              }
            } else {
              logger.info(
                `[AI RESPONSE LOG] ✅ No placeholder patterns detected - AI used actual data`,
              );
            }

            logger.debug(
              `[generateResponse] Parsed structured response with ${actions.length} actions`,
            );
          } else {
            // Invalid structure or parse error - wrap in proper format as fallback
            logger.warn(
              "[generateResponse] Response is not valid JSON - AI violated format requirement, wrapping in fallback format",
            );
            logger.warn(
              `[AI RESPONSE LOG] ❌ CRITICAL: AI did not respond in required JSON format!`,
            );
            logger.warn(`[AI RESPONSE LOG] Parse error: ${parseResult.error}`);
            if (parseResult.parsedKeys) {
              logger.warn(
                `[AI RESPONSE LOG] Parsed object keys: ${parseResult.parsedKeys.join(", ")}`,
              );
            }
            logger.warn(
              `[AI RESPONSE LOG] Raw response (first 500 chars): ${parseResult.rawResponse || rawResponse.substring(0, 500)}`,
            );

            // Check if response contains placeholders
            const hasPlaceholders =
              /\[ACTUAL_(MEMBER|USERNAME|ROLE|CHANNEL)/i.test(rawResponse);
            if (hasPlaceholders) {
              logger.error(
                `[AI RESPONSE LOG] ❌ AI used placeholder data instead of real data!`,
              );
            }

            // Fallback: Automatically wrap non-JSON responses in JSON format
            // This ensures the bot can still function even if AI doesn't follow format
            try {
              // Try to create a proper JSON response from the raw text
              const wrappedResponse = {
                message: rawResponse.trim(),
                actions: [],
              };
              // Use the wrapped response as if it came from JSON
              finalResponse = wrappedResponse.message;
              actions = wrappedResponse.actions;
              logger.info(
                `[AI RESPONSE LOG] ✅ Auto-wrapped non-JSON response in JSON format`,
              );
            } catch (wrapError) {
              // If wrapping fails, just use raw response
              finalResponse = rawResponse.trim();
              logger.error("Failed to wrap response:", wrapError);
            }

            // Old marker-based execution removed - now using JSON actions only
          }

          // Process structured actions if we have them
          if (actions.length > 0 && guild) {
            try {
              const actionResult = await this.executeStructuredActions(
                actions,
                guild,
                client,
                options.user,
                options.channel,
              );

              const actionResults = actionResult.results;
              // Commands now send responses directly to channel, so no need to capture them

              // Check if any actions were data fetch actions (fetch_members, fetch_all, etc.)
              const fetchActions = actions.filter(
                a =>
                  a.type === "fetch_members" ||
                  a.type === "fetch_channels" ||
                  a.type === "fetch_roles" ||
                  a.type === "fetch_all",
              );

              // If fetch actions were executed, re-query AI with updated context
              if (fetchActions.length > 0) {
                logger.info(
                  `[generateResponse] Fetch actions executed, re-querying AI with updated data`,
                );

                // Rebuild system context with freshly fetched data
                const updatedSystemMessage = await this.buildSystemContext(
                  guild,
                  client,
                  userMessage,
                );

                // Get updated conversation history
                const updatedHistory =
                  await this.getConversationHistory(userId);

                // Build messages array with updated context
                const updatedMessages = [];
                const hasSystemMessage =
                  updatedHistory.length > 0 &&
                  updatedHistory[0]?.role === "system";
                if (hasSystemMessage) {
                  updatedMessages.push({
                    role: "system",
                    content: updatedSystemMessage,
                  });
                } else {
                  updatedMessages.push({
                    role: "system",
                    content: updatedSystemMessage,
                  });
                }

                const startIndex = hasSystemMessage ? 1 : 0;
                for (let i = startIndex; i < updatedHistory.length; i++) {
                  updatedMessages.push({
                    role: updatedHistory[i].role,
                    content: updatedHistory[i].content,
                  });
                }

                // Add user message and AI's previous response
                updatedMessages.push({ role: "user", content: userMessage });
                updatedMessages.push({
                  role: "assistant",
                  content: finalResponse,
                });
                updatedMessages.push({
                  role: "user",
                  content: FOLLOW_UP_PROMPT_TEMPLATE,
                });

                // Re-query AI with updated context (with timeout)
                const followUpPromise = this.aiService.generate({
                  type: "text",
                  prompt: updatedMessages,
                  config: {
                    systemMessage: updatedSystemMessage,
                    temperature: 0.7,
                    maxTokens: wantsDetail ? 800 : 500,
                    forceJson: true, // Force JSON format for structured output
                  },
                });

                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(
                    () => reject(new Error("Follow-up query timed out")),
                    FOLLOW_UP_QUERY_TIMEOUT,
                  );
                });

                const followUpResult = await Promise.race([
                  followUpPromise,
                  timeoutPromise,
                ]);

                const followUpResponse =
                  followUpResult.text ||
                  followUpResult.response ||
                  finalResponse;

                // Parse follow-up response
                const followUpParseResult =
                  this.parseJsonResponse(followUpResponse);
                if (followUpParseResult.success) {
                  finalResponse = followUpParseResult.data.message;
                  logger.info(
                    `[generateResponse] ✅ Follow-up response generated with actual data`,
                  );
                } else {
                  logger.warn(
                    `[generateResponse] Follow-up response parse failed: ${followUpParseResult.error}`,
                  );
                  finalResponse = followUpResponse;
                }
              } else {
                // For non-fetch actions, include data results in response
                const dataResults = actionResults.filter(
                  r => r.startsWith("Data:") || r.startsWith("Found:"),
                );
                const commandResults = actionResults.filter(r =>
                  r.startsWith("Command Result:"),
                );
                const statusResults = actionResults.filter(
                  r =>
                    !r.startsWith("Data:") &&
                    !r.startsWith("Found:") &&
                    !r.startsWith("Command Result:"),
                );

                // Commands now send their responses directly to the channel
                // So we don't need to handle commandResponsesToSend anymore
                // Just handle text results if any
                // Commands now send their responses directly to the channel
                // Suppress generic AI messages when commands execute successfully
                if (commandResults.length > 0) {
                  logger.info(
                    `[generateResponse] Command executed - response already sent to channel by command handler`,
                  );
                  // Check if the AI's message is generic/acknowledgment-only
                  const genericPatterns = [
                    /^I'll (execute|run|show|display|get|fetch)/i,
                    /^Let me (execute|run|show|display|get|fetch)/i,
                    /^I'll (execute|run) (the|that) .+ (command|for you)/i,
                    /^Executing/i,
                    /^Running/i,
                  ];
                  const isGenericMessage = genericPatterns.some(pattern =>
                    pattern.test(finalResponse.trim()),
                  );

                  if (isGenericMessage) {
                    // Suppress generic message - command already sent its response
                    finalResponse = "";
                    logger.info(
                      `[generateResponse] Suppressed generic AI message - command response already sent`,
                    );
                  }
                }

                if (dataResults.length > 0) {
                  // Include data in response for AI to use
                  finalResponse += `\n\n**Additional Information:**\n${dataResults.map(r => r.replace(/^(Data:|Found:)\s*/, "")).join("\n")}`;
                }

                // Log status results but don't clutter user response
                if (statusResults.length > 0) {
                  logger.debug(
                    `[generateResponse] Action status: ${statusResults.join(", ")}`,
                  );
                }
              }
            } catch (error) {
              logger.error("Error executing structured actions:", error);
            }
          }

          // Final safety check: sanitize response to prevent sensitive data leakage
          const beforeSanitize = finalResponse;
          finalResponse = this.sanitizeData(finalResponse);

          // Log final response
          logger.info(
            `[AI RESPONSE LOG] Final Response (${finalResponse.length} chars):`,
          );
          logger.info(finalResponse);
          if (beforeSanitize !== finalResponse) {
            logger.info(
              `[AI RESPONSE LOG] ⚠️ Response was sanitized (sensitive data removed)`,
            );
          }
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          // Add AI response to conversation history (sanitized, with LTM)
          await this.addToHistory(userId, {
            role: "assistant",
            content: finalResponse,
          });

          // Return text response - commands send their own responses directly to channel
          return {
            text: finalResponse,
            commandResponses: [], // Commands send directly, no need to return them
          };
        } catch (error) {
          logger.error("Chat generation failed:", error);
          throw error;
        }
      },
      {
        userId,
        coreUserData,
      },
    );
  }
}

export const chatService = new ChatService();
