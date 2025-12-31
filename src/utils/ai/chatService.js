import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { conversationManager } from "./conversationManager.js";
import { MemoryManager } from "./memory/memoryManager.js";
import {
  DEFAULT_MAX_HISTORY_LENGTH,
  DEFAULT_CONVERSATION_TIMEOUT,
  DEFAULT_MAX_CONVERSATIONS,
  STREAMING_ENABLED,
} from "./constants.js";
import { performanceMonitor } from "./performanceMonitor.js";
import { actionExecutor } from "./actionExecutor.js";
import { AI_STATUS_MESSAGES } from "./statusMessages.js";
import {
  buildMessagesArray,
  prepareConversationContext as prepareConversationContextUtil,
} from "./chat/conversationBuilder.js";
import {
  parseAIResponse,
  validateAndSanitizeResponse,
  deductCreditsIfNeeded,
} from "./chat/responseProcessor.js";
import {
  processActionsAndReQuery,
  processNonFetchActions,
} from "./chat/actionHandler.js";
import {
  detectActionRequest,
  prepareSystemContextAndLog,
  performSmartMemberFetch,
} from "./chat/preparationHelpers.js";
import {
  generateAIResponseWithOptimization,
  processAIResponse,
  finalizeResponse,
  setupQueueStatusCallback,
} from "./chat/responseGenerator.js";
import {
  setupStreamingCallbacks,
  performStreamingGeneration,
  processStreamingResponse,
} from "./chat/streamingHelpers.js";

const logger = getLogger();

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

    // Initialize memory manager for summarization
    this.memoryManager = new MemoryManager(conversationManager);

    // Set callback to clear summaries when conversations are cleared
    conversationManager.setClearCallback((userId, guildId) => {
      return this.memoryManager.clearSummary(userId, guildId);
    });

    conversationManager.startCleanup();
  }

  /**
   * Build messages array - delegates to conversationBuilder module
   */
  async buildMessagesArray(
    userId,
    guildId,
    userMessage,
    systemMessage,
    history,
    locale,
    needsAction,
    addToHistory = true,
  ) {
    return buildMessagesArray(
      userId,
      guildId,
      userMessage,
      systemMessage,
      history,
      locale,
      needsAction,
      (uid, gid, msg) => this.addToHistory(uid, gid, msg),
      addToHistory,
    );
  }

  /**
   * Parse AI response - delegates to responseProcessor module
   */
  parseAIResponse(rawResponse, hasDetectedActions = false) {
    return parseAIResponse(rawResponse, hasDetectedActions);
  }

  /**
   * Deduct credits - delegates to responseProcessor module
   */
  async deductCreditsIfNeeded(userId, result, callType, fallbackText = "") {
    return deductCreditsIfNeeded(userId, result, callType, fallbackText);
  }

  /**
   * Detect action request - delegates to preparationHelpers module
   */
  async detectActionRequest(userMessage, client = null) {
    return detectActionRequest(userMessage, client);
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
   * Execute structured actions - delegates to actionExecutor
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
   * Process actions and handle re-query - delegates to actionHandler module
   */
  async processActionsAndReQuery(actions, finalResponse, context) {
    return processActionsAndReQuery(actions, finalResponse, context, {
      aiService: this.aiService,
      parseAIResponse: (response, hasDetected = false) =>
        this.parseAIResponse(response, hasDetected),
      deductCreditsIfNeeded: (userId, result, callType, fallback = "") =>
        this.deductCreditsIfNeeded(userId, result, callType, fallback),
      addToHistory: (userId, guildId, message) =>
        this.addToHistory(userId, guildId, message),
    });
  }

  /**
   * Process non-fetch actions - delegates to actionHandler module
   */
  async processNonFetchActions(
    actions,
    actionResults,
    finalResponse,
    userId,
    guildId,
  ) {
    return processNonFetchActions(
      actions,
      actionResults,
      finalResponse,
      userId,
      guildId,
      (uid, gid, msg) => this.addToHistory(uid, gid, msg),
    );
  }

  /**
   * Update conversation history and summary
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} finalResponse - AI response to store
   * @param {boolean} responseSuppressed - Whether response was suppressed
   * @returns {Promise<void>}
   */
  async updateConversationHistory(
    userId,
    guildId,
    finalResponse,
    responseSuppressed,
  ) {
    // Don't store empty responses when command was executed
    if (finalResponse && finalResponse.trim().length > 0) {
      await this.addToHistory(userId, guildId, {
        role: "assistant",
        content: finalResponse,
      });

      // Periodically update summary if conversation is long enough
      const allMessages = await conversationManager.getConversationHistory(
        userId,
        guildId,
      );
      const nonSystemMessages = allMessages.filter(m => m.role !== "system");
      if (nonSystemMessages.length > 0 && nonSystemMessages.length % 10 === 0) {
        const recentMessageCount = 5;
        const oldMessages =
          nonSystemMessages.length > recentMessageCount
            ? nonSystemMessages.slice(0, -recentMessageCount)
            : [];
        if (oldMessages.length > 0) {
          this.memoryManager
            .updateSummary(userId, guildId, oldMessages)
            .catch(error => {
              logger.debug("Failed to update summary:", error);
            });
        }
      }
    } else if (responseSuppressed) {
      logger.debug(
        `[generateResponse] Skipping empty response storage (command executed, already stored command info)`,
      );
    }
  }

  /**
   * Prepare system context and log - delegates to preparationHelpers module
   */
  async prepareSystemContextAndLog(guild, client, userMessage, options = {}) {
    return prepareSystemContextAndLog(guild, client, userMessage, options);
  }

  /**
   * Perform smart member fetch - delegates to preparationHelpers module
   */
  async performSmartMemberFetch(guild, userMessage, onStatus = null) {
    return performSmartMemberFetch(guild, userMessage, onStatus);
  }

  /**
   * Prepare conversation context - delegates to conversationBuilder module
   */
  async prepareConversationContext(
    userId,
    guildId,
    userMessage,
    systemMessage,
    client,
    locale,
    onStatus = null,
    useMemoryManager = true,
  ) {
    return prepareConversationContextUtil(
      userId,
      guildId,
      userMessage,
      systemMessage,
      client,
      locale,
      onStatus,
      (msg, cli) => this.detectActionRequest(msg, cli),
      useMemoryManager
        ? (uid, gid) => this.memoryManager.getConversationContext(uid, gid)
        : (uid, gid) => conversationManager.getConversationHistory(uid, gid),
      (uid, gid, msg) => this.addToHistory(uid, gid, msg),
      useMemoryManager,
    );
  }

  /**
   * Setup queue status callback - delegates to responseGenerator module
   */
  setupQueueStatusCallback(requestId, onQueueStatus, onStatus) {
    return setupQueueStatusCallback(requestId, onQueueStatus, onStatus);
  }

  /**
   * Generate AI response with optimization - delegates to responseGenerator module
   */
  async generateAIResponseWithOptimization(
    messages,
    systemMessage,
    userMessage,
    requestId,
  ) {
    return generateAIResponseWithOptimization(
      this.aiService,
      messages,
      systemMessage,
      userMessage,
      requestId,
    );
  }

  /**
   * Process AI response - delegates to responseGenerator module
   */
  async processAIResponse(
    result,
    userId,
    guild,
    userMessage,
    locale,
    options,
    guildId,
  ) {
    return processAIResponse(
      result,
      userId,
      guild,
      userMessage,
      locale,
      options,
      guildId,
      {
        parseAIResponse: (response, hasDetected = false) =>
          this.parseAIResponse(response, hasDetected),
        validateAndSanitizeResponse: (response, g, isJson) =>
          validateAndSanitizeResponse(response, g, isJson),
        deductCreditsIfNeeded: (uid, res, callType, fallback = "") =>
          this.deductCreditsIfNeeded(uid, res, callType, fallback),
        processActionsAndReQuery: (actions, finalResp, ctx) =>
          this.processActionsAndReQuery(actions, finalResp, ctx),
      },
    );
  }

  /**
   * Finalize response - delegates to responseGenerator module
   */
  async finalizeResponse(
    userId,
    guildId,
    finalResponse,
    responseSuppressed,
    requestStartTime,
  ) {
    return finalizeResponse(
      userId,
      guildId,
      finalResponse,
      responseSuppressed,
      requestStartTime,
      (uid, gid, resp, suppressed) =>
        this.updateConversationHistory(uid, gid, resp, suppressed),
    );
  }

  /**
   * Setup streaming callbacks - delegates to streamingHelpers module
   */
  setupStreamingCallbacks(onChunk) {
    return setupStreamingCallbacks(onChunk);
  }

  /**
   * Perform streaming generation - delegates to streamingHelpers module
   */
  async performStreamingGeneration(messages, textProvider, chunkCallback) {
    return performStreamingGeneration(
      this.aiService,
      messages,
      textProvider,
      chunkCallback,
    );
  }

  /**
   * Process streaming response - delegates to streamingHelpers module
   */
  async processStreamingResponse(
    result,
    state,
    userId,
    guildId,
    userMessage,
    onChunk,
    textProvider,
    requestStartTime,
  ) {
    return processStreamingResponse(
      result,
      state,
      userId,
      guildId,
      userMessage,
      onChunk,
      textProvider,
      requestStartTime,
      (response, hasDetected) => this.parseAIResponse(response, hasDetected),
      (uid, res, callType, fallback) =>
        this.deductCreditsIfNeeded(uid, res, callType, fallback),
      (uid, gid, msg) => this.addToHistory(uid, gid, msg),
    );
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

    // Prepare system context and log summary
    const systemMessage = await this.prepareSystemContextAndLog(
      guild,
      client,
      userMessage,
      {
        userId: options.userId,
        locale: options.locale || "en-US",
        user: options.user,
        onStatus,
      },
    );

    // Perform smart member fetching
    await this.performSmartMemberFetch(guild, userMessage, onStatus);

    // Prepare conversation context
    const guildId = guild?.id || null;
    const { messages } = await this.prepareConversationContext(
      userId,
      guildId,
      userMessage,
      systemMessage,
      client,
      locale || "en-US",
      onStatus,
      true, // Use memory manager
    );

    // Add user message to history (without context/reminder)
    await this.addToHistory(userId, guildId, {
      role: "user",
      content: userMessage,
    });

    const requestId = `chat-${userId || "unknown"}-${Date.now()}`;

    // Setup queue status callback
    const queueStatusCallback = this.setupQueueStatusCallback(
      requestId,
      options.onQueueStatus || null,
      onStatus,
    );

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Generate AI response with optimization
          const { result, wantsDetail } =
            await this.generateAIResponseWithOptimization(
              messages,
              systemMessage,
              userMessage,
              requestId,
            );

          // Process AI response (parse, validate, handle actions)
          const { finalResponse, responseSuppressed } =
            await this.processAIResponse(
              result,
              userId,
              guild,
              userMessage,
              locale || "en-US",
              {
                client,
                user: options.user,
                channel: options.channel,
                wantsDetail,
              },
              guildId,
            );

          // Finalize response (update history, record metrics)
          return await this.finalizeResponse(
            userId,
            guildId,
            finalResponse,
            responseSuppressed,
            requestStartTime,
          );
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
        onQueueStatus: queueStatusCallback,
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

    // Prepare system context and log summary
    const systemMessage = await this.prepareSystemContextAndLog(
      guild,
      client,
      userMessage,
      {
        userId: options.userId,
        locale: options.locale || "en-US",
        user: options.user,
        onStatus,
      },
    );

    // Perform smart member fetching
    await this.performSmartMemberFetch(guild, userMessage, onStatus);

    // Prepare conversation context (use conversationManager for streaming, not memoryManager)
    const guildId = guild?.id || null;
    const { messages } = await this.prepareConversationContext(
      userId,
      guildId,
      userMessage,
      systemMessage,
      client,
      options.locale || "en-US",
      onStatus,
      false, // Use conversationManager for streaming
    );

    // Update status before AI generation
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.CRAFTING_RESPONSE);

    // Setup streaming callbacks
    const { chunkCallback, finalCallback, state } =
      this.setupStreamingCallbacks(onChunk);

    try {
      // Perform streaming generation
      const result = await this.performStreamingGeneration(
        messages,
        textProvider,
        chunkCallback,
      );

      finalCallback();

      // Process streaming response
      return await this.processStreamingResponse(
        result,
        state,
        userId,
        guildId,
        userMessage,
        onChunk,
        textProvider,
        requestStartTime,
      );
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
