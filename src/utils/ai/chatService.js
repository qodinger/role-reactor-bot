import dedent from "dedent";
import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { conversationManager } from "./conversationManager.js";
import { responseValidator } from "./responseValidator.js";
import { systemPromptBuilder } from "./systemPromptBuilder.js";
import { actionTriggersReQuery } from "./actionRegistry.js";
import {
  DEFAULT_MAX_HISTORY_LENGTH,
  DEFAULT_CONVERSATION_TIMEOUT,
  DEFAULT_MAX_CONVERSATIONS,
  MAX_RESPONSE_LENGTH,
  FOLLOW_UP_QUERY_TIMEOUT,
  STREAMING_ENABLED,
  STREAMING_UPDATE_INTERVAL,
} from "./constants.js";
import { performanceMonitor } from "./performanceMonitor.js";
import { jsonParser } from "./jsonParser.js";
import { dataFetcher } from "./dataFetcher.js";
import { actionExecutor } from "./actionExecutor.js";

const logger = getLogger();

// Follow-up prompt template (when data is fetched)
const FOLLOW_UP_PROMPT_TEMPLATE = dedent`
  I've attempted to fetch the member data. Check the action results below to see if it was successful or if errors occurred.

  **CRITICAL INSTRUCTIONS:**
  1. **If the fetch was successful:** Look at the "COMPLETE LIST OF HUMAN MEMBER NAMES" section in the system context above
  2. **If errors occurred:** You MUST inform the user about the errors. Explain what went wrong and what data is available (cached members, if any)
  3. **If successful:** Use ONLY the member names from the list (format: "- Name 🟢 (status)")
  4. **If successful:** Copy the EXACT names from that list - type them character by character as shown
  5. **Format the list naturally** - you can use numbered lists, bullet points, or any clear format that makes sense
  6. Do NOT invent, guess, or make up ANY member names
  7. Do NOT use generic names like "iFunny", "Reddit", "Discord", "John", "Alice", "Bob", "Charlie"
  8. Use ONLY the actual member names from the "COMPLETE LIST OF HUMAN MEMBER NAMES" section (if available)

  **IMPORTANT:** If there were errors fetching members, you MUST tell the user about the error clearly. Don't pretend the data was fetched successfully if it wasn't.
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
    this.commandNamesCache = null;
    this.commandNamesCacheTime = 0;
    this.COMMAND_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Initialize conversation manager with configuration
    const maxHistoryLength =
      parseInt(process.env.AI_CONVERSATION_HISTORY_LENGTH) ||
      DEFAULT_MAX_HISTORY_LENGTH;
    const conversationTimeout =
      parseInt(process.env.AI_CONVERSATION_TIMEOUT) ||
      DEFAULT_CONVERSATION_TIMEOUT;
    const maxConversations =
      parseInt(process.env.AI_MAX_CONVERSATIONS) || DEFAULT_MAX_CONVERSATIONS;

    conversationManager.initLongTermMemory();
    conversationManager.setConfig({
      maxHistoryLength,
      conversationTimeout,
      maxConversations,
    });
    conversationManager.startCleanup();
  }

  /**
   * Detect if user message suggests an action should be performed
   * This is a general detection that works for ALL actions, not just specific ones
   * @param {string} userMessage - User's message
   * @param {import('discord.js').Client} client - Discord client (optional, for command name checking)
   * @returns {Promise<boolean>} True if message suggests an action should be performed
   */
  async detectActionRequest(userMessage, client = null) {
    if (!userMessage || typeof userMessage !== "string") {
      return false;
    }

    const userMessageLower = userMessage.toLowerCase().trim();

    // Common action verbs that suggest the user wants something done
    const actionVerbs = [
      "play",
      "execute",
      "run",
      "show",
      "get",
      "fetch",
      "create",
      "add",
      "remove",
      "delete",
      "kick",
      "ban",
      "timeout",
      "warn",
      "send",
      "pin",
      "unpin",
      "modify",
      "change",
      "update",
      "set",
      "give",
      "take",
      "grant",
      "revoke",
      "challenge",
      "start",
      "begin",
      "do",
      "make",
      "perform",
      "carry out",
    ];

    // Check if message starts with or contains action verbs
    const startsWithAction = actionVerbs.some(
      verb =>
        userMessageLower.startsWith(verb) ||
        userMessageLower.startsWith(`let's ${verb}`) ||
        userMessageLower.startsWith(`let us ${verb}`),
    );

    // Check if message contains action verbs followed by common objects/commands
    const containsActionPattern = actionVerbs.some(verb => {
      const verbIndex = userMessageLower.indexOf(verb);
      if (verbIndex === -1) return false;

      // Check if verb is followed by something (not just standalone)
      const afterVerb = userMessageLower
        .substring(verbIndex + verb.length)
        .trim();
      return afterVerb.length > 0 && !afterVerb.startsWith("?");
    });

    // Check for imperative patterns (commands/directives)
    const imperativePatterns = [
      /^(please\s+)?(can you|could you|would you|will you)\s+/i,
      /^(please\s+)?(do|make|show|get|fetch|execute|run|play)\s+/i,
      /^(let's|let us)\s+/i,
      /^(i want|i need|i'd like)\s+/i,
    ];
    const isImperative = imperativePatterns.some(pattern =>
      pattern.test(userMessage),
    );

    // Check if message mentions command names (if client is available)
    let mentionsCommand = false;
    if (client?.commands) {
      try {
        // Get command names from client
        const commandNames = Array.from(client.commands.keys());
        mentionsCommand = commandNames.some(
          cmdName =>
            userMessageLower.includes(cmdName.toLowerCase()) ||
            userMessageLower.includes(`/${cmdName}`),
        );
      } catch (_error) {
        // Ignore errors
      }
    }

    // Check for action-related keywords
    const actionKeywords = [
      "command",
      "action",
      "again",
      "retry",
      "another",
      "next",
      "more",
      "serverinfo",
      "userinfo",
      "avatar",
      "poll",
      "rps",
      "rock",
      "paper",
      "scissors",
      "leaderboard",
      "level",
      "xp",
      "members",
      "roles",
      "channels",
    ];
    const hasActionKeywords = actionKeywords.some(keyword =>
      userMessageLower.includes(keyword),
    );

    // Return true if any indicator suggests an action
    return (
      startsWithAction ||
      containsActionPattern ||
      isImperative ||
      mentionsCommand ||
      hasActionKeywords
    );
  }

  /**
   * Get conversation history for a user in a specific server (delegates to conversationManager)
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID (null for DMs)
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversationHistory(userId, guildId = null) {
    return conversationManager.getConversationHistory(userId, guildId);
  }

  /**
   * Add message to conversation history (delegates to conversationManager)
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID (null for DMs)
   * @param {Object} message - Message object with role and content
   */
  async addToHistory(userId, guildId, message) {
    return conversationManager.addToHistory(userId, guildId, message);
  }

  /**
   * Clear conversation history for a user in a specific server (delegates to conversationManager)
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID (null for DMs)
   */
  async clearHistory(userId, guildId = null) {
    return conversationManager.clearHistory(userId, guildId);
  }

  /**
   * Get optimized parameters for a specific model
   * Optimizes maxTokens and temperature based on model characteristics for better speed and quality
   * @param {string|null} modelName - Model name/identifier
   * @returns {Object} Optimized parameters { maxTokens, temperature }
   */
  getModelOptimizations(modelName) {
    if (!modelName) {
      // Default fallback
      return { maxTokens: 2000, temperature: 0.7 };
    }

    const modelLower = modelName.toLowerCase();

    // DeepSeek models (optimize based on model type)
    if (modelLower.includes("deepseek-r2")) {
      return { maxTokens: 1800, temperature: 0.5 }; // R2 is faster, can handle more tokens
    }
    if (modelLower.includes("deepseek-r1-0528")) {
      return { maxTokens: 2000, temperature: 0.5 }; // Enhanced R1: Better performance, can handle more
    }
    if (modelLower.includes("deepseek-r1")) {
      return { maxTokens: 1500, temperature: 0.5 }; // R1 is slower reasoning model, reduce tokens
    }
    if (
      modelLower.includes("deepseek-chat") ||
      modelLower.includes("deepseek-v3")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // V3/Chat: Fast general purpose, matches GPT-4o
    }
    if (modelLower.includes("deepseek-v3-base")) {
      return { maxTokens: 2000, temperature: 0.7 }; // V3 Base: Free model, good performance
    }
    if (modelLower.includes("deepseek")) {
      return { maxTokens: 2000, temperature: 0.6 }; // Other DeepSeek variants
    }

    // Claude models (fast, excellent reasoning)
    if (
      modelLower.includes("claude-3.5-haiku") ||
      modelLower.includes("claude-3-haiku")
    ) {
      return { maxTokens: 2000, temperature: 0.6 }; // Haiku is optimized for speed
    }
    if (
      modelLower.includes("claude-3.5-sonnet") ||
      modelLower.includes("claude-3-sonnet")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // Sonnet is balanced
    }
    if (
      modelLower.includes("claude-3.5-opus") ||
      modelLower.includes("claude-3-opus")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // Opus is high quality
    }
    if (modelLower.includes("claude")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Other Claude models
    }

    // GPT models
    if (
      modelLower.includes("gpt-4o-mini") ||
      modelLower.includes("gpt-4-mini")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // Fast and efficient
    }
    if (modelLower.includes("gpt-4o") || modelLower.includes("gpt-4-turbo")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Fast GPT-4 variants
    }
    if (modelLower.includes("gpt-4")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Standard GPT-4
    }
    if (modelLower.includes("gpt-3.5-turbo")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Fast GPT-3.5
    }
    if (modelLower.includes("gpt")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Other GPT models
    }

    // Mistral models
    if (
      modelLower.includes("mistral-medium") ||
      modelLower.includes("mistral-large")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // Balanced Mistral models
    }
    if (modelLower.includes("mistral")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Other Mistral models
    }

    // Gemini models
    if (
      modelLower.includes("gemini-pro") ||
      modelLower.includes("gemini-flash")
    ) {
      return { maxTokens: 2000, temperature: 0.7 }; // Fast Gemini models
    }
    if (modelLower.includes("gemini")) {
      return { maxTokens: 2000, temperature: 0.7 }; // Other Gemini models
    }

    // Self-hosted models (typically slower, optimize for speed)
    if (modelLower.includes("llama") || modelLower.includes("ollama")) {
      return { maxTokens: 1500, temperature: 0.6 }; // Self-hosted models benefit from lower limits
    }

    // Default fallback for unknown models
    return { maxTokens: 2000, temperature: 0.7 };
  }

  /**
   * Validate action structure and required fields
   * @param {Object} action - Action object to validate
   * @returns {Object} Validation result with isValid and error message
   * @private
   */
  validateAction(action) {
    return actionExecutor.validateAction(action);
  }

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
    return actionExecutor.executeStructuredActions(
      actions,
      guild,
      client,
      user,
      channel,
    );
  }

  /**
   * Get detailed information about a specific member
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with user_id or username
   * @returns {Promise<string|null>} Member information or null if not found
   * @deprecated Use dataFetcher.getMemberInfo() instead
   */
  async getMemberInfo(guild, options) {
    return dataFetcher.getMemberInfo(guild, options);
  }

  /**
   * Get detailed information about a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<string|null>} Role information or null if not found
   * @deprecated Use dataFetcher.getRoleInfo() instead
   */
  async getRoleInfo(guild, options) {
    return dataFetcher.getRoleInfo(guild, options);
  }

  /**
   * Get detailed information about a specific channel
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with channel_name or channel_id
   * @returns {Promise<string|null>} Channel information or null if not found
   * @deprecated Use dataFetcher.getChannelInfo() instead
   */
  async getChannelInfo(guild, options) {
    return dataFetcher.getChannelInfo(guild, options);
  }

  /**
   * Get guidance for command errors to help AI understand what went wrong
   * @param {string} errorMessage - Error message
   * @param {Object} action - Action that failed
   * @returns {Promise<string>} Guidance message
   * @deprecated Use actionExecutor.getCommandErrorGuidance() instead
   * @private
   */
  async getCommandErrorGuidance(errorMessage, action) {
    return actionExecutor.getCommandErrorGuidance(errorMessage, action);
  }

  /**
   * Search for members with a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<Array<string>|null>} Array of member names or null if role not found
   * @deprecated Use dataFetcher.searchMembersByRole() instead
   */
  async searchMembersByRole(guild, options) {
    return dataFetcher.searchMembersByRole(guild, options);
  }

  /**
   * Smart member fetch with auto-detection
   * Automatically fetches members if needed based on cache coverage and user query
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {string} userMessage - User's message (for keyword detection)
   * @returns {Promise<{fetched: boolean, reason: string, cached: number, total: number}>}
   * @deprecated Use dataFetcher.smartMemberFetch() instead
   */
  async smartMemberFetch(guild, userMessage = "") {
    return dataFetcher.smartMemberFetch(guild, userMessage);
  }

  /**
   * Fetch all members for a guild
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Promise<{success: boolean, error?: string, fetched?: number, total?: number}>}
   * @deprecated Use dataFetcher.fetchMembers() instead
   */
  async fetchMembers(guild) {
    return dataFetcher.fetchMembers(guild);
  }

  /**
   * Handle dynamic data fetching actions (get_role_reaction_messages, get_scheduled_roles, etc.)
   * @param {string} actionType - Action type (e.g., "get_role_reaction_messages")
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @returns {Promise<string|null>} Formatted data string or null if action not handled
   * @deprecated Use dataFetcher.handleDynamicDataFetching() instead
   * @private
   */
  async handleDynamicDataFetching(actionType, guild, _client) {
    return dataFetcher.handleDynamicDataFetching(actionType, guild, _client);
  }

  /**
   * Parse JSON response from AI, handling markdown code blocks and extra text
   * @param {string} rawResponse - Raw AI response text
   * @returns {Object} Parsed result with {success: boolean, data?: object, error?: string}
   * @deprecated Use jsonParser.parseJsonResponse() instead
   * @private
   */
  parseJsonResponse(rawResponse) {
    return jsonParser.parseJsonResponse(rawResponse);
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
    // Track performance - start timer
    const requestStartTime = Date.now();
    const { userId, coreUserData, locale, onStatus } = options;

    if (!this.aiService.isEnabled()) {
      throw new Error(
        "AI chat is not available. Please enable a text-capable AI provider in the bot configuration.",
      );
    }

    // Build system context with user message for on-demand command injection
    if (onStatus) await onStatus("Preparing my response...");
    const systemMessage = await systemPromptBuilder.buildSystemContext(
      guild,
      client,
      userMessage,
      options.locale || "en-US",
      options.user || null, // Pass requester information
      { userId: options.userId }, // Pass userId for preference loading
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
          // Match list items - handle various formats:
          // "- name", "1. name", "- name 🟢 (status)", etc.
          // Use multiline flag and match across lines
          const memberLines =
            memberListSection.match(/^\s*[-•*]\s+.+$/gm) ||
            memberListSection.match(/^\s*\d+\.\s+.+$/gm) ||
            [];
          const memberNames = memberLines.length;

          if (memberNames > 0) {
            logger.info(
              `[AI CONTEXT LOG] Member list found in prompt: ${memberNames} members`,
            );
          }
        }
      }
    }

    // ============================================================================
    // PHASE 1: Smart Member Fetching (Auto-Detection)
    // ============================================================================
    // Automatically fetch members if needed based on user query and cache coverage
    if (guild && userMessage) {
      if (onStatus) await onStatus("Checking server details...");
      const fetchResult = await dataFetcher.smartMemberFetch(
        guild,
        userMessage,
      );
      if (fetchResult.fetched) {
        logger.info(
          `[generateResponse] Auto-fetched ${fetchResult.fetchedCount} members (${fetchResult.cached}/${fetchResult.total} total, ${Math.round((fetchResult.coverage || 0) * 100)}% coverage)`,
        );
      } else {
        logger.debug(
          `[generateResponse] Smart fetch skipped: ${fetchResult.reason} (${fetchResult.cached || 0}/${fetchResult.total || 0} cached)`,
        );
      }
    }

    // Get conversation history for this user in this server (with LTM support)
    // Trust the AI to understand context - it can naturally detect when greetings indicate a new topic
    if (onStatus) await onStatus("Reviewing our conversation...");
    const guildId = guild?.id || null;
    const history = await this.getConversationHistory(userId, guildId);

    // Build messages array with conversation history (optimized)
    const messages = [];

    // Optimized: Check if system message exists (usually first message)
    const hasSystemMessage =
      history.length > 0 && history[0]?.role === "system";

    if (hasSystemMessage) {
      // Update system message in case server context changed (use cached version)
      messages.push({ role: "system", content: systemMessage });
      // Update in memory only (system messages are not persisted to storage)
      if (history[0].content !== systemMessage) {
        history[0].content = systemMessage;
        // System messages are kept in memory only, not persisted to storage
        // They're dynamically generated and very large, so we don't save them
      }
    } else {
      // First message in conversation - add system message
      messages.push({ role: "system", content: systemMessage });
      // System messages are kept in memory only, not persisted to storage
      // addToHistory will handle this (it filters out system messages)
      await this.addToHistory(userId, guildId, {
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
    await this.addToHistory(userId, guildId, {
      role: "user",
      content: userMessage,
    });

    const requestId = `chat-${userId || "unknown"}-${Date.now()}`;

    // Queue status callback for position updates
    const onQueueStatus = options.onQueueStatus || null;

    // Helper to format queue status message
    const formatQueueStatus = (position, totalInSystem, waitTime) => {
      if (position === null) {
        // Processing or not in queue
        return null;
      }
      if (position === 0) {
        return "Starting processing...";
      }

      // Format wait time nicely
      let waitText;
      if (waitTime < 60) {
        waitText = `${Math.ceil(waitTime)} sec`;
      } else {
        const minutes = Math.ceil(waitTime / 60);
        waitText = minutes === 1 ? "~1 min" : `~${minutes} min`;
      }

      // Show position in queue (1-based for user-friendly display)
      return `Waiting in queue (position ${position + 1}, ${waitText} estimated wait)`;
    };

    // Wrapper for queue status callback that also calls onStatus
    const queueStatusCallback = (position, totalInSystem, waitTime) => {
      if (onQueueStatus) {
        // Pass requestId so handlers can show cancel button
        onQueueStatus(position, totalInSystem, waitTime, requestId);
      }
      // Also update regular status if provided
      if (onStatus) {
        const queueMessage = formatQueueStatus(
          position,
          totalInSystem,
          waitTime,
        );
        if (queueMessage) {
          // Pass requestId for cancel button
          onStatus(queueMessage, requestId, position);
        } else if (position === null) {
          // Request is now processing (no cancel button needed)
          onStatus("Crafting my response...", null, null);
        }
      }
    };

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Get model-specific optimizations
          const currentModel =
            this.aiService.config.providers.openrouter?.models?.text?.primary ||
            this.aiService.config.providers.openai?.models?.text?.primary ||
            this.aiService.config.providers.selfhosted?.models?.text?.primary;
          const modelOpts = this.getModelOptimizations(currentModel);

          // Determine maxTokens based on user's request and model capabilities
          // Check if user explicitly asks for detailed explanation
          const wantsDetail =
            userMessage.toLowerCase().includes("explain") ||
            userMessage.toLowerCase().includes("tell me more") ||
            userMessage.toLowerCase().includes("in detail") ||
            userMessage.toLowerCase().includes("elaborate") ||
            userMessage.toLowerCase().includes("describe") ||
            userMessage.toLowerCase().includes("how does") ||
            userMessage.toLowerCase().includes("how do");

          // Use model-optimized maxTokens, but scale down for concise responses
          // Base maxTokens from model optimization, then adjust for detail preference
          const baseMaxTokens = modelOpts.maxTokens;
          const maxTokens = wantsDetail
            ? Math.min(baseMaxTokens, 1200) // Cap at 1200 for detailed responses
            : Math.min(Math.floor(baseMaxTokens * 0.4), 600); // ~40% of base for concise (capped at 600)

          // Add a final reminder about format to the user message
          // Note: messages[messages.length - 1] already contains userMessageWithContext

          // Detect if user is asking for an action (works for ALL actions, not just specific ones)
          const isActionRequest = await this.detectActionRequest(
            userMessage,
            client,
          );

          const reminder = isActionRequest
            ? `[CRITICAL: The user is asking you to PERFORM AN ACTION (execute a command, play a game, fetch data, modify roles, etc.). You MUST use JSON format with actions array: {"message": "...", "actions": [...]}. DO NOT respond in plain text - you need to execute an action!]`
            : `[CRITICAL REMINDER: If you need to execute actions (commands, role changes, etc.), use JSON format: {"message": "...", "actions": [...]}. If you have NO actions (empty actions array), you MUST respond in plain text/markdown format - NO JSON, NO curly braces, NO code blocks. Just write your response directly.]`;

          const userMessageWithReminder = `${messages[messages.length - 1].content}\n\n${reminder}`;

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
              temperature: modelOpts.temperature, // Use model-optimized temperature
              maxTokens, // Adaptive: based on model and user preference
              forceJson: false, // Don't force JSON - let AI choose based on whether actions are needed
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

          // Parse response - can be JSON (if actions) or plain text (if no actions)
          let finalResponse;
          let actions = [];

          const parseResult = jsonParser.parseJsonResponse(rawResponse);

          if (parseResult.success) {
            // JSON format detected
            // Ensure message is a string (handle edge cases)
            finalResponse =
              typeof parseResult.data.message === "string"
                ? parseResult.data.message
                : String(parseResult.data.message || "");
            // Ensure actions is an array (handle edge cases)
            actions = Array.isArray(parseResult.data.actions)
              ? parseResult.data.actions
              : [];

            // Post-processing: If actions array is empty, convert to plain text format
            // This ensures users see clean text even if AI uses JSON unnecessarily
            if (actions.length === 0) {
              logger.info(
                `[AI RESPONSE LOG] ⚠️ AI used JSON format with empty actions - converting to plain text`,
              );
              // Treat as plain text response (no actions)
              // finalResponse already contains the message, actions is already empty
              // This is handled the same as plain text responses below
            }

            // If parsed message is "No response generated" (fallback), treat it as empty
            // This will be suppressed later if a command executed
            if (
              finalResponse === "No response generated." ||
              finalResponse.trim() === ""
            ) {
              finalResponse = "";
            }

            // Log parsed JSON structure
            if (actions.length > 0) {
              logger.info(
                `[AI RESPONSE LOG] ✅ Successfully parsed JSON response (with ${actions.length} actions)`,
              );
            } else {
              logger.info(
                `[AI RESPONSE LOG] ✅ Parsed JSON response (empty actions - treated as plain text)`,
              );
            }
          } else {
            // Plain text format - no actions
            finalResponse = rawResponse.trim();
            actions = [];
            logger.info(
              `[AI RESPONSE LOG] ✅ Plain text response (no actions)`,
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

            // Validate response data accuracy
            if (guild) {
              const validation = responseValidator.validateResponseData(
                finalResponse,
                guild,
              );

              if (!validation.valid || validation.warnings.length > 0) {
                logger.warn(`[AI RESPONSE LOG] ⚠️ DATA VALIDATION WARNINGS:`);
                validation.warnings.forEach(warning => {
                  logger.warn(`[AI RESPONSE LOG] - ${warning}`);
                });
                if (validation.suggestions.length > 0) {
                  logger.info(
                    `[AI RESPONSE LOG] 💡 Suggestions for improvement:`,
                  );
                  validation.suggestions.forEach(suggestion => {
                    logger.info(`[AI RESPONSE LOG] - ${suggestion}`);
                  });
                }
                logger.info(
                  `[AI RESPONSE LOG] Server has ${validation.actualDataCounts.members} members, ${validation.actualDataCounts.roles} roles, ${validation.actualDataCounts.channels} channels`,
                );
              } else {
                logger.info(
                  `[AI RESPONSE LOG] ✅ Data validation passed - response uses real server data`,
                );
              }
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
          }

          // Track if response was intentionally suppressed (e.g., command executed)
          let responseSuppressed = false;

          // Process structured actions if we have them
          // For non-streaming, we still need to execute actions to get results for follow-up queries
          // But we'll delay command response sending by returning actions separately
          // Actions will be executed after the message is sent (in messageCreate.js)
          // This allows the AI's text message to appear above command response embeds
          let actionResults = [];
          if (actions.length > 0 && guild) {
            // Execute actions and collect results for follow-up queries
            // Commands send their responses directly to the channel
            try {
              const actionResult = await this.executeStructuredActions(
                actions,
                guild,
                client,
                options.user,
                options.channel,
              );

              actionResults = actionResult.results;
              // Commands now send responses directly to channel, so no need to capture them

              // Check if any actions trigger re-query (using registry)
              const fetchActions = actions.filter(a =>
                actionTriggersReQuery(a.type),
              );

              // If fetch actions or structure-modifying actions were executed, re-query AI with updated context
              if (fetchActions.length > 0) {
                logger.info(
                  `[generateResponse] Context-modifying actions executed: ${fetchActions.map(a => a.type).join(", ")}, re-querying AI with updated data`,
                );

                // Determine what data to force include based on action types
                const memberActions = fetchActions.filter(
                  a => a.type === "fetch_members",
                );

                // Rebuild system context with freshly fetched/updated data
                // Force include member list if member-related actions were executed
                // (Channel and role lists are always included in server info, so no need to force them)
                const updatedSystemMessage =
                  await systemPromptBuilder.buildSystemContext(
                    guild,
                    client,
                    userMessage,
                    options.locale || "en-US",
                    options.user || null,
                    {
                      userId: options.userId,
                      forceIncludeMemberList:
                        memberActions.length > 0 ||
                        fetchActions.some(a => a.type === "fetch_all"),
                    },
                  );

                // Verify member list is in the updated context
                const hasMemberList = updatedSystemMessage.includes(
                  "COMPLETE LIST OF HUMAN MEMBER NAMES",
                );
                logger.info(
                  `[generateResponse] Updated context includes member list: ${hasMemberList}`,
                );

                // Get updated conversation history
                const updatedHistory = await this.getConversationHistory(
                  userId,
                  guildId,
                );

                // Build messages array with updated context
                const updatedMessages = [];
                const hasSystemMessage =
                  updatedHistory.length > 0 &&
                  updatedHistory[0]?.role === "system";
                // Add system message (always add, even if it existed before)
                updatedMessages.push({
                  role: "system",
                  content: updatedSystemMessage,
                });

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

                // Build follow-up prompt with action results
                let followUpPrompt = FOLLOW_UP_PROMPT_TEMPLATE;

                // Include action results (including errors) for AI to report to users
                if (actionResults && actionResults.length > 0) {
                  const errorResults = actionResults.filter(r =>
                    r.startsWith("Error:"),
                  );
                  const successResults = actionResults.filter(r =>
                    r.startsWith("Success:"),
                  );

                  if (errorResults.length > 0) {
                    followUpPrompt += `\n\n**IMPORTANT - Action Results (Errors Occurred):**\n${errorResults.map(r => `- ${r}`).join("\n")}\n\n**You MUST inform the user about these errors.** Explain what went wrong and what data is available (if any).`;
                  } else if (successResults.length > 0) {
                    followUpPrompt += `\n\n**Action Results (Success):**\n${successResults.map(r => `- ${r}`).join("\n")}\n\n**You can mention this success to the user if relevant.**`;
                  }
                }

                updatedMessages.push({
                  role: "user",
                  content: followUpPrompt,
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
                  jsonParser.parseJsonResponse(followUpResponse);
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
                // Suppress AI messages when commands execute successfully
                // The command's response is already visible to the user
                if (commandResults.length > 0) {
                  logger.info(
                    `[generateResponse] Command executed - response already sent to channel by command handler`,
                  );

                  // Track executed commands for LTM (Long-Term Memory)
                  // Extract command information from actions to store in history
                  const executedCommands = actions
                    .filter(a => a.type === "execute_command")
                    .map(a => {
                      const cmd = a.command;
                      const subcmd = a.subcommand;
                      const opts = a.options || {};
                      // Format: /command subcommand option:value
                      let cmdStr = `/${cmd}`;
                      if (subcmd) {
                        cmdStr += ` ${subcmd}`;
                      }
                      const optStrings = Object.entries(opts)
                        .map(([key, value]) => {
                          // Format options nicely
                          if (Array.isArray(value)) {
                            return `${key}:${value.join(",")}`;
                          }
                          return `${key}:${value}`;
                        })
                        .filter(Boolean);
                      if (optStrings.length > 0) {
                        cmdStr += ` ${optStrings.join(" ")}`;
                      }
                      return cmdStr;
                    });

                  // Store executed commands in LTM for future reference
                  // Format: Mark as completed (not retry needed) so AI doesn't retry the action
                  if (executedCommands.length > 0) {
                    const commandHistoryMessage = `[Action completed - do not retry: ${executedCommands.join(", ")}]`;
                    await this.addToHistory(userId, guildId, {
                      role: "assistant",
                      content: commandHistoryMessage,
                    });
                    logger.debug(
                      `[generateResponse] Stored command execution in LTM: ${commandHistoryMessage}`,
                    );
                  }

                  // When a command executes successfully, suppress ALL AI responses
                  // unless they contain important error information
                  // The command's response is already visible to the user
                  const hasErrorInfo =
                    /error|failed|unable|cannot|issue|problem|exception|crash/i.test(
                      finalResponse,
                    );

                  // IMPORTANT: Always suppress when command executes, unless there's error info
                  if (!hasErrorInfo) {
                    // Suppress ALL responses when command executed successfully
                    // (empty, redundant, fallback, or acknowledgment)
                    finalResponse = "";
                    responseSuppressed = true;
                    logger.info(
                      `[generateResponse] Suppressed AI message (command executed successfully) - keeping response empty`,
                    );
                  } else {
                    // Keep error messages even when command executed (might be important)
                    logger.info(
                      `[generateResponse] Keeping AI response (contains error info) despite command execution`,
                    );
                  }
                }

                if (dataResults.length > 0) {
                  // Include data in response for AI to use
                  finalResponse += `\n\n**Additional Information:**\n${dataResults.map(r => r.replace(/^(Data:|Found:)\s*/, "")).join("\n")}`;
                }

                // Include error/status results in AI response so it can learn from them
                if (statusResults.length > 0) {
                  logger.debug(
                    `[generateResponse] Action status: ${statusResults.join(", ")}`,
                  );
                  // Add error information to response so AI knows what went wrong
                  const errorMessages = statusResults.filter(
                    r => r.includes("Error") || r.includes("Failed"),
                  );
                  if (errorMessages.length > 0) {
                    // Include error context in response for AI learning
                    if (!finalResponse) {
                      finalResponse = "";
                    }
                    const errorSection = `\n\n**⚠️ Action Errors:**\n${errorMessages.join("\n")}`;
                    finalResponse += errorSection;
                    logger.info(
                      `[generateResponse] Including error messages in response for AI learning: ${errorMessages.length} error(s)`,
                    );

                    // Store error information in LTM so AI can learn from it
                    // Format: Mark as completed (not retry needed) so AI doesn't retry the action
                    const errorHistoryMessage = `[Action completed with errors - do not retry: ${errorMessages.map(e => e.replace(/Command Error: /, "")).join("; ")}]`;
                    await this.addToHistory(userId, guildId, {
                      role: "assistant",
                      content: errorHistoryMessage,
                    });
                    logger.debug(
                      `[generateResponse] Stored command error in LTM for AI learning: ${errorHistoryMessage}`,
                    );
                  }
                }
              }
            } catch (error) {
              logger.error("Error executing structured actions:", error);
            }
          }

          // Final safety checks: sanitize response and validate data accuracy
          const beforeSanitize = finalResponse;
          finalResponse = responseValidator.sanitizeData(finalResponse);

          // Additional validation: Check for empty or invalid responses
          // But don't set fallback if response was intentionally suppressed (e.g., command executed)
          if (!finalResponse || finalResponse.trim().length === 0) {
            if (!responseSuppressed) {
              logger.warn(
                `[AI RESPONSE LOG] ⚠️ Response is empty after processing, using fallback`,
              );
              finalResponse =
                "I couldn't generate a response. Please try rephrasing your question or use /help for available commands.";
            } else {
              logger.info(
                `[AI RESPONSE LOG] Response intentionally suppressed (command executed), keeping empty`,
              );
            }
          }

          // Check response length to prevent Discord embed limit issues
          if (finalResponse && finalResponse.length > MAX_RESPONSE_LENGTH) {
            logger.warn(
              `[AI RESPONSE LOG] ⚠️ Response exceeds maximum length (${finalResponse.length} > ${MAX_RESPONSE_LENGTH}), truncating`,
            );
            finalResponse = `${finalResponse.substring(0, MAX_RESPONSE_LENGTH - 3)}...`;
          }

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
          // Don't store empty responses when command was executed (already stored command execution above)
          if (finalResponse && finalResponse.trim().length > 0) {
            await this.addToHistory(userId, guildId, {
              role: "assistant",
              content: finalResponse,
            });
          } else if (responseSuppressed) {
            // Command executed - command execution was already stored above, skip empty message
            logger.debug(
              `[generateResponse] Skipping empty response storage (command executed, already stored command info)`,
            );
          }

          // Return text response - commands send their own responses directly to channel
          // Record performance metrics
          const responseTime = Date.now() - requestStartTime;
          performanceMonitor.recordRequest({
            provider: "ai-chat",
            responseTime,
            success: true,
          });

          // Return message and actions
          // Note: For non-streaming, actions may have already been executed for follow-up queries
          // In that case, command responses were already sent, so we return empty actions array
          // For streaming mode, actions are returned separately and executed after message is sent
          return {
            text: finalResponse,
            actions: [], // Actions already executed for non-streaming (for follow-up queries), empty for streaming
            commandResponses: [], // Commands send directly, no need to return them
          };
        } catch (error) {
          // Record failed request in performance monitor
          const responseTime = Date.now() - requestStartTime;
          performanceMonitor.recordRequest({
            provider: "ai-chat",
            responseTime,
            success: false,
            error: error.message,
          });
          logger.error("Chat generation failed:", error);
          throw error;
        }
      },
      {
        userId,
        coreUserData,
        rateLimitReserved: options.rateLimitReserved || false,
        onQueueStatus: queueStatusCallback, // Pass queue status callback wrapper
      },
    );
  }

  /**
   * Generate streaming AI response
   * @param {string} userMessage - User's message
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {Object} options - Additional options
   * @param {Function} options.onChunk - Callback for each chunk (fullText: string) => void
   * @returns {Promise<Object>} Response with text and commandResponses
   */
  async generateResponseStreaming(userMessage, guild, client, options = {}) {
    const { onChunk, userId, onStatus } = options;

    if (!onChunk || typeof onChunk !== "function") {
      throw new Error("onChunk callback is required for streaming");
    }

    // Check if streaming is enabled
    if (!STREAMING_ENABLED) {
      logger.debug(
        "[generateResponseStreaming] Streaming disabled, falling back to non-streaming",
      );
      return await this.generateResponse(userMessage, guild, client, options);
    }

    // Check if provider supports streaming
    const textProvider = this.aiService.getTextProvider();
    if (
      !textProvider ||
      !["openrouter", "openai", "selfhosted"].includes(textProvider)
    ) {
      // Fallback to non-streaming
      logger.warn(
        `[generateResponseStreaming] Provider ${textProvider} doesn't support streaming, falling back to non-streaming`,
      );
      return await this.generateResponse(userMessage, guild, client, options);
    }

    // Track performance - start timer
    const requestStartTime = Date.now();

    if (!this.aiService.isEnabled()) {
      throw new Error(
        "AI chat is not available. Please enable a text-capable AI provider in the bot configuration.",
      );
    }

    // Build system context (same as non-streaming)
    if (onStatus) await onStatus("Preparing my response...");
    const systemMessage = await systemPromptBuilder.buildSystemContext(
      guild,
      client,
      userMessage,
      options.locale || "en-US",
      options.user || null,
      { userId: options.userId },
    );

    // Smart member fetch (same as non-streaming)
    if (guild && userMessage) {
      if (onStatus) await onStatus("Checking server details...");
      const fetchResult = await dataFetcher.smartMemberFetch(
        guild,
        userMessage,
      );
      if (fetchResult.fetched) {
        logger.info(
          `[generateResponseStreaming] Auto-fetched ${fetchResult.fetchedCount} members`,
        );
      }
    }

    // Get conversation history
    if (onStatus) await onStatus("Reviewing our conversation...");
    const guildId = guild?.id || null;
    const history = await this.getConversationHistory(userId, guildId);
    const messages = [];

    // Add system message
    const hasSystemMessage =
      history.length > 0 && history[0]?.role === "system";
    if (hasSystemMessage) {
      messages.push({ role: "system", content: systemMessage });
    } else {
      messages.push({ role: "system", content: systemMessage });
      await this.addToHistory(userId, guildId, {
        role: "system",
        content: systemMessage,
      });
    }

    // Add conversation history
    const startIndex = hasSystemMessage ? 1 : 0;
    for (let i = startIndex; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: history[i].content,
      });
    }

    // Add user message with enhanced context for action detection
    // Detect if user is asking for an action (works for ALL actions, not just specific ones)
    const needsAction = await this.detectActionRequest(userMessage, client);

    const reminder = needsAction
      ? `[CRITICAL: The user is asking you to PERFORM AN ACTION (execute a command, play a game, fetch data, modify roles, etc.). You MUST use JSON format with actions array: {"message": "...", "actions": [...]}. DO NOT respond in plain text - you need to execute an action!]`
      : `[CRITICAL REMINDER: If you need to execute actions (commands, role changes, etc.), use JSON format: {"message": "...", "actions": [...]}. If you have NO actions (empty actions array), you MUST respond in plain text/markdown format - NO JSON, NO curly braces, NO code blocks. Just write your response directly.]`;

    const enhancedUserMessage = `${userMessage}\n\n${reminder}`;

    messages.push({ role: "user", content: enhancedUserMessage });

    // Update status before AI generation
    if (onStatus) await onStatus("Crafting my response...");

    // Generate streaming response
    let fullText = "";
    let lastUpdateTime = Date.now();
    let hasDetectedActions = false; // Track if we've detected actions in the response

    const chunkCallback = chunk => {
      fullText += chunk;

      // Check if response contains actions (JSON format with actions array)
      // If actions are detected, don't stream updates - wait for complete response
      if (!hasDetectedActions) {
        // Quick check: if response starts with JSON or contains "actions" field, likely has actions
        const trimmed = fullText.trim();
        if (
          trimmed.startsWith("{") ||
          trimmed.startsWith("```json") ||
          /"actions"\s*:\s*\[/.test(fullText)
        ) {
          hasDetectedActions = true;
          logger.debug(
            "[generateResponseStreaming] Detected actions in response - disabling streaming updates",
          );
          // Don't call onChunk - wait for complete response
          return;
        }
      }

      // Only stream if no actions detected (plain text response)
      if (!hasDetectedActions) {
        // Throttle Discord updates (update every STREAMING_UPDATE_INTERVAL ms)
        const now = Date.now();
        if (now - lastUpdateTime >= STREAMING_UPDATE_INTERVAL) {
          onChunk(fullText); // Send accumulated text
          lastUpdateTime = now;
        }
      }
    };

    // Final callback to ensure last chunk is sent
    const finalCallback = () => {
      // If actions were detected, we'll update with final message after parsing
      // Otherwise, send the final accumulated text
      if (fullText && !hasDetectedActions) {
        onChunk(fullText);
      }
    };

    try {
      // Get the current model for optimization
      const currentModel =
        this.aiService.config.providers.openrouter?.models?.text?.primary ||
        this.aiService.config.providers.openai?.models?.text?.primary ||
        this.aiService.config.providers.selfhosted?.models?.text?.primary;

      // Optimize parameters based on model characteristics
      const { maxTokens, temperature } =
        this.getModelOptimizations(currentModel);

      const result = await this.aiService.generateTextStreaming({
        prompt: messages,
        model: null, // Use default
        config: {
          systemMessage: null, // Already in messages
          temperature,
          maxTokens,
        },
        provider: textProvider,
        onChunk: chunkCallback,
      });

      finalCallback();

      // Parse JSON response if needed (same as non-streaming)
      const parsed = jsonParser.parseJsonResponse(result.text || fullText);

      // Log raw response for debugging
      const rawResponseText = result.text || fullText;
      logger.debug(
        `[generateResponseStreaming] Raw response (${rawResponseText.length} chars): ${rawResponseText.substring(0, 300)}${rawResponseText.length > 300 ? "..." : ""}`,
      );

      // Post-processing: If JSON has empty actions, treat as plain text
      const finalMessage = parsed.success
        ? typeof parsed.data.message === "string"
          ? parsed.data.message
          : String(parsed.data.message || "")
        : result.text || fullText || "";
      const finalActions = parsed.success
        ? Array.isArray(parsed.data.actions)
          ? parsed.data.actions
          : []
        : [];

      // Log what we detected
      logger.info(
        `[generateResponseStreaming] Parsed response - JSON: ${parsed.success}, Actions: ${finalActions.length}, Detected during streaming: ${hasDetectedActions}`,
      );
      if (parsed.success && finalActions.length > 0) {
        logger.info(
          `[generateResponseStreaming] Action details: ${JSON.stringify(finalActions)}`,
        );
      }

      // If actions were detected during streaming, we didn't show updates
      // Now that we have the complete response, update with the final message
      if (hasDetectedActions && onChunk) {
        // Extract and display only the message text (not the JSON)
        onChunk(finalMessage || "🤔 Processing...");
      }

      // If actions array is empty, convert to plain text format
      if (parsed.success && finalActions.length === 0) {
        logger.info(
          `[generateResponseStreaming] AI used JSON with empty actions - treating as plain text`,
        );
        // finalMessage already contains the message text
      }

      // Add to conversation history
      await this.addToHistory(userId, guildId, {
        role: "user",
        content: userMessage,
      });
      await this.addToHistory(userId, guildId, {
        role: "assistant",
        content: finalMessage,
      });

      // Track performance
      const responseTime = Date.now() - requestStartTime;
      performanceMonitor.recordRequest({
        provider: textProvider,
        responseTime,
        success: true,
        type: "ai-chat-streaming",
      });

      // Return message and actions separately - actions will be executed after message is sent
      // This allows the AI's text message to appear above command response embeds
      return {
        text: finalMessage,
        actions: finalActions, // Return actions to be executed later
        commandResponses: [], // Will be populated after actions are executed
      };
    } catch (error) {
      // Track error
      const responseTime = Date.now() - requestStartTime;
      performanceMonitor.recordRequest({
        provider: textProvider,
        responseTime,
        success: false,
        error: error.message,
        type: "ai-chat-streaming",
      });

      logger.error("[generateResponseStreaming] Error:", error);

      // If streaming fails, fallback to non-streaming
      if (
        error.message.includes("streaming") ||
        error.message.includes("stream")
      ) {
        logger.warn(
          "[generateResponseStreaming] Streaming failed, falling back to non-streaming",
        );
        return await this.generateResponse(userMessage, guild, client, options);
      }

      throw error;
    }
  }
}

export const chatService = new ChatService();
