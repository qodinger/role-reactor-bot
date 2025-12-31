import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { conversationManager } from "./conversationManager.js";
import { MemoryManager } from "./memory/memoryManager.js";
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
import { getModelOptimizations } from "./modelOptimizer.js";
import { checkAndDeductAICredits } from "./aiCreditManager.js";
import { AI_STATUS_MESSAGES } from "./statusMessages.js";

const logger = getLogger();

// Follow-up prompt template (loaded dynamically with caching)
import { getPrompt } from "../../config/prompts/index.js";

async function getFollowUpPromptTemplate(variables = {}) {
  return await getPrompt("chat", "followUpTemplate", variables);
}

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
   * Add message to conversation history (delegates to conversationManager)
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID (null for DMs)
   * @param {Object} message - Message object with role and content
   */
  async addToHistory(userId, guildId, message) {
    return conversationManager.addToHistory(userId, guildId, message);
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
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.PREPARING);
    const systemMessage = await systemPromptBuilder.buildSystemContext(
      guild,
      client,
      userMessage,
      options.locale || "en-US",
      options.user || null, // Pass requester information
      { userId: options.userId }, // Pass userId for preference loading
    );

    // Log system context summary (debug level)
    logger.debug(
      `[AI] Context: User ${userId || "unknown"} | Guild: ${guild?.name || "DM"} | Prompt: ${systemMessage.length} chars`,
    );
    if (guild) {
      const memberCount = guild.members.cache.filter(m => !m.user.bot).size;
      const roleCount = guild.roles.cache.size;
      const channelCount = guild.channels.cache.size;
      logger.debug(
        `[AI] Server context: ${memberCount} members, ${roleCount} roles, ${channelCount} channels`,
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
            logger.debug(`[AI] Member list in prompt: ${memberNames} members`);
          }
        }
      }
    }

    // ============================================================================
    // PHASE 1: Smart Member Fetching (Auto-Detection)
    // ============================================================================
    // Automatically fetch members if needed based on user query and cache coverage
    if (guild && userMessage) {
      if (onStatus) await onStatus(AI_STATUS_MESSAGES.CHECKING_SERVER);
      const fetchResult = await dataFetcher.smartMemberFetch(
        guild,
        userMessage,
      );
      if (fetchResult.fetched) {
        logger.debug(
          `[generateResponse] Auto-fetched ${fetchResult.fetchedCount} members (${fetchResult.cached}/${fetchResult.total} cached)`,
        );
      } else {
        logger.debug(
          `[generateResponse] Smart fetch skipped: ${fetchResult.reason} (${fetchResult.cached || 0}/${fetchResult.total || 0} cached)`,
        );
      }
    }

    // Get conversation context with summarization (if enabled)
    // Trust the AI to understand context - it can naturally detect when greetings indicate a new topic
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.REVIEWING_CONVERSATION);
    const guildId = guild?.id || null;
    const history = await this.memoryManager.getConversationContext(
      userId,
      guildId,
    );

    // Build messages array with conversation history (optimized)
    const messages = [];

    // Optimized: Check if system message exists (usually first message)
    // Also check if summary exists (memory manager may add it as system message)
    const hasSystemMessage =
      history.length > 0 && history[0]?.role === "system";
    const hasSummary =
      hasSystemMessage &&
      history[0]?.content?.includes("Previous conversation summary:");

    if (hasSystemMessage) {
      // If summary exists, add it first, then add main system message
      if (hasSummary) {
        messages.push(history[0]); // Add summary
        messages.push({ role: "system", content: systemMessage }); // Add main system message
      } else {
        // Update system message in case server context changed (use cached version)
        messages.push({ role: "system", content: systemMessage });
        // Update in memory only (system messages are not persisted to storage)
        if (history[0].content !== systemMessage) {
          history[0].content = systemMessage;
        }
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

    // Optimized: Add conversation history (skip system/summary, already added)
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

    // Helper to format queue status message (uses centralized status messages)
    const formatQueueStatus = (position, totalInSystem, waitTime) => {
      return AI_STATUS_MESSAGES.QUEUE_POSITION(
        position,
        totalInSystem,
        waitTime,
      );
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
          onStatus(AI_STATUS_MESSAGES.CRAFTING_RESPONSE, null, null);
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
          const modelOpts = getModelOptimizations(currentModel);

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

          // Build final messages array with reminder
          const finalMessages = [
            ...messages.slice(0, -1), // All messages except the last one
            {
              ...messages[messages.length - 1],
              content: userMessageWithReminder, // Replace last message with reminder
            },
          ];

          // Log prompt summary (debug level for detailed logs)
          logger.debug(
            `[AI] Request ${requestId}: ${finalMessages.length} messages, ${JSON.stringify(finalMessages).length} chars`,
          );

          const result = await this.aiService.generate({
            type: "text",
            prompt: finalMessages,
            config: {
              systemMessage,
              temperature: modelOpts.temperature, // Use model-optimized temperature
              maxTokens, // Adaptive: based on model and user preference
              forceJson: false, // Don't force JSON - let AI choose based on whether actions are needed
            },
            // Use primary provider (self-hosted if enabled, otherwise fallback)
          });

          // Deduct credits for initial API call only if it actually costs money
          // Only deduct if: result exists, has valid content (not empty), and tokens were consumed
          // If API call failed, provider would have thrown an error before we reach here
          const responseText = result?.text || result?.response || "";
          const hasValidContent =
            responseText.trim().length > 0 &&
            responseText !== "No response generated.";
          // Check usage data - this is the definitive indicator that tokens were consumed = costs money
          // For non-streaming, usage data should always be present for successful calls
          const hasUsageData =
            result?.usage &&
            (result.usage.prompt_tokens > 0 ||
              result.usage.completion_tokens > 0 ||
              result.usage.total_tokens > 0);

          // Only deduct if we have valid content AND usage data shows tokens were consumed
          // This ensures we only charge when the API actually processed tokens (costs money)
          if (userId && hasValidContent && hasUsageData) {
            const deductionResult = await checkAndDeductAICredits(userId);
            if (!deductionResult.success) {
              logger.error(
                `Failed to deduct credits for initial API call for user ${userId}: ${deductionResult.error}`,
              );
              // Continue anyway - don't fail the request, but log the error
            } else {
              logger.debug(
                `Deducted ${deductionResult.creditsDeducted} Core for initial API call (${deductionResult.creditsRemaining} remaining)`,
              );
            }
          } else if (userId && hasValidContent && !hasUsageData) {
            // Valid content but no usage data - might be self-hosted or provider doesn't report usage
            // For safety, still deduct if we have valid content (API succeeded = likely cost money)
            // But log a warning for monitoring
            logger.warn(
              `Deducting credits without usage data for user ${userId} (provider: ${result?.provider || "unknown"}) - assuming tokens were consumed`,
            );
            const deductionResult = await checkAndDeductAICredits(userId);
            if (deductionResult.success) {
              logger.debug(
                `Deducted ${deductionResult.creditsDeducted} Core for initial API call (${deductionResult.creditsRemaining} remaining)`,
              );
            }
          } else if (userId && !hasValidContent) {
            logger.warn(
              `Skipping credit deduction for user ${userId}: API call returned empty or invalid content`,
            );
          }

          const rawResponse =
            result.text || result.response || "No response generated.";

          // Log response summary (debug level for detailed logs)
          logger.debug(
            `[AI] Response: ${rawResponse.length} chars for user ${userId || "unknown"}`,
          );

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
              logger.debug(
                `[AI] JSON format with empty actions - converting to plain text`,
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

            // Log parsed JSON structure (debug level)
            if (actions.length > 0) {
              logger.debug(
                `[AI] Parsed JSON response with ${actions.length} actions`,
              );
            }
          } else {
            // Plain text format - no actions
            finalResponse = rawResponse.trim();
            actions = [];
            logger.debug(`[AI] Plain text response (no actions)`);

            // Validate response data accuracy
            if (guild) {
              const validation = responseValidator.validateResponseData(
                finalResponse,
                guild,
              );

              if (!validation.valid || validation.warnings.length > 0) {
                logger.warn(
                  `[AI] Data validation warnings: ${validation.warnings.length} issue(s)`,
                );
                validation.warnings.forEach(warning => {
                  logger.debug(`[AI] Validation: ${warning}`);
                });
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
                `[AI] CRITICAL: Response contains placeholder patterns instead of real data`,
              );
              // Log first matching pattern for debugging
              const foundPattern = placeholderPatterns.find(pattern =>
                finalResponse.includes(pattern),
              );
              if (foundPattern) {
                logger.debug(`[AI] Found placeholder: "${foundPattern}"`);
              }
            }
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
              // SAFEGUARD: Only allow 1 re-query per request to prevent infinite loops and unexpected costs
              // Re-query responses are treated as final (no further re-queries)
              if (fetchActions.length > 0) {
                logger.debug(
                  `[generateResponse] Re-querying after actions: ${fetchActions.map(a => a.type).join(", ")}`,
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
                logger.debug(
                  `[generateResponse] Updated context includes member list: ${hasMemberList}`,
                );

                // Get updated conversation history
                const updatedHistory =
                  await conversationManager.getConversationHistory(
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
                let followUpPrompt = await getFollowUpPromptTemplate();

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

                let followUpResult;
                try {
                  followUpResult = await Promise.race([
                    followUpPromise,
                    timeoutPromise,
                  ]);

                  // Deduct credits for re-query API call only if it actually costs money
                  // Only deduct if: result exists, has valid content (not empty), and tokens were consumed
                  const reQueryText =
                    followUpResult?.text || followUpResult?.response || "";
                  const reQueryHasValidContent =
                    reQueryText.trim().length > 0 &&
                    reQueryText !== "No response generated." &&
                    reQueryText !== finalResponse; // Don't charge if we're using fallback
                  // Check usage data - this is the definitive indicator that tokens were consumed = costs money
                  const reQueryHasUsageData =
                    followUpResult?.usage &&
                    (followUpResult.usage.prompt_tokens > 0 ||
                      followUpResult.usage.completion_tokens > 0 ||
                      followUpResult.usage.total_tokens > 0);

                  // Only deduct if we have valid content AND usage data shows tokens were consumed
                  if (userId && reQueryHasValidContent && reQueryHasUsageData) {
                    const reQueryDeduction =
                      await checkAndDeductAICredits(userId);
                    if (!reQueryDeduction.success) {
                      logger.error(
                        `Failed to deduct credits for re-query API call for user ${userId}: ${reQueryDeduction.error}`,
                      );
                      // Continue anyway - don't fail the request, but log the error
                    } else {
                      logger.debug(
                        `Deducted ${reQueryDeduction.creditsDeducted} Core for re-query API call (${reQueryDeduction.creditsRemaining} remaining)`,
                      );
                    }
                  } else if (
                    userId &&
                    reQueryHasValidContent &&
                    !reQueryHasUsageData
                  ) {
                    // Valid content but no usage data - might be self-hosted or provider doesn't report usage
                    // For safety, still deduct if we have valid content (API succeeded = likely cost money)
                    logger.warn(
                      `Deducting credits for re-query without usage data for user ${userId} (provider: ${followUpResult?.provider || "unknown"}) - assuming tokens were consumed`,
                    );
                    const reQueryDeduction =
                      await checkAndDeductAICredits(userId);
                    if (reQueryDeduction.success) {
                      logger.debug(
                        `Deducted ${reQueryDeduction.creditsDeducted} Core for re-query API call (${reQueryDeduction.creditsRemaining} remaining)`,
                      );
                    }
                  } else if (userId && !reQueryHasValidContent) {
                    logger.warn(
                      `Skipping credit deduction for re-query for user ${userId}: API call returned empty or invalid content`,
                    );
                  }
                } catch (error) {
                  // Timeout or other error - don't deduct credits
                  logger.warn(
                    `Re-query failed or timed out for user ${userId}: ${error.message}`,
                  );
                  // Use fallback response
                  followUpResult = { text: finalResponse };
                }

                const followUpResponse =
                  followUpResult?.text ||
                  followUpResult?.response ||
                  finalResponse;

                // Parse follow-up response
                const followUpParseResult =
                  jsonParser.parseJsonResponse(followUpResponse);
                if (followUpParseResult.success) {
                  finalResponse = followUpParseResult.data.message;

                  // SAFEGUARD: Check if re-query response contains actions that would trigger another re-query
                  // If so, log a warning but don't process them (prevent infinite loops and unexpected costs)
                  const followUpActions = Array.isArray(
                    followUpParseResult.data.actions,
                  )
                    ? followUpParseResult.data.actions
                    : [];
                  const followUpReQueryActions = followUpActions.filter(a =>
                    actionTriggersReQuery(a.type),
                  );

                  if (followUpReQueryActions.length > 0) {
                    logger.warn(
                      `[generateResponse] ⚠️ Re-query response contains actions that would trigger another re-query (${followUpReQueryActions.map(a => a.type).join(", ")}). Ignoring to prevent infinite loops. Maximum 2 API calls per request.`,
                    );
                  }

                  logger.debug(
                    `[generateResponse] Follow-up response generated`,
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
                  logger.debug(
                    `[generateResponse] Command executed - response sent by handler`,
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
                    logger.debug(
                      `[generateResponse] Suppressed AI message (command executed)`,
                    );
                  } else {
                    // Keep error messages even when command executed (might be important)
                    logger.debug(
                      `[generateResponse] Keeping AI response (contains error info)`,
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
                    logger.debug(
                      `[generateResponse] Including ${errorMessages.length} error(s) in response`,
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
              logger.debug(`[AI] Response suppressed (command executed)`);
            }
          }

          // Check response length to prevent Discord embed limit issues
          if (finalResponse && finalResponse.length > MAX_RESPONSE_LENGTH) {
            logger.warn(
              `[AI] Response exceeds max length (${finalResponse.length} > ${MAX_RESPONSE_LENGTH}), truncating`,
            );
            finalResponse = `${finalResponse.substring(0, MAX_RESPONSE_LENGTH - 3)}...`;
          }

          // Log final response
          logger.debug(`[AI] Final response: ${finalResponse.length} chars`);
          if (beforeSanitize !== finalResponse) {
            logger.debug(
              `[AI] Response was sanitized (sensitive data removed)`,
            );
          }

          // Add AI response to conversation history (sanitized, with LTM)
          // Don't store empty responses when command was executed (already stored command execution above)
          if (finalResponse && finalResponse.trim().length > 0) {
            await this.addToHistory(userId, guildId, {
              role: "assistant",
              content: finalResponse,
            });

            // Periodically update summary if conversation is long enough
            // Update every 10 messages to keep summary current
            const allMessages =
              await conversationManager.getConversationHistory(userId, guildId);
            const nonSystemMessages = allMessages.filter(
              m => m.role !== "system",
            );
            if (
              nonSystemMessages.length > 0 &&
              nonSystemMessages.length % 10 === 0
            ) {
              // Update summary with all old messages (beyond recent 5), not just last 10
              // This ensures summary includes all accumulated old messages
              const recentMessageCount = 5; // Match memoryManager.recentMessageCount
              const oldMessages =
                nonSystemMessages.length > recentMessageCount
                  ? nonSystemMessages.slice(0, -recentMessageCount)
                  : [];
              if (oldMessages.length > 0) {
                // Update summary in background (don't wait)
                this.memoryManager
                  .updateSummary(userId, guildId, oldMessages)
                  .catch(error => {
                    logger.debug("Failed to update summary:", error);
                  });
              }
            }
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
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.PREPARING);
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
      if (onStatus) await onStatus(AI_STATUS_MESSAGES.CHECKING_SERVER);
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
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.REVIEWING_CONVERSATION);
    const guildId = guild?.id || null;
    const history = await conversationManager.getConversationHistory(
      userId,
      guildId,
    );
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
    if (onStatus) await onStatus(AI_STATUS_MESSAGES.CRAFTING_RESPONSE);

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
          // Show a status message that we're processing actions
          if (onChunk) {
            // Try to extract any message text that might be in the JSON so far
            const messageMatch = fullText.match(/"message"\s*:\s*"([^"]*)"/);
            const extractedMessage = messageMatch ? messageMatch[1] : null;
            if (extractedMessage && extractedMessage.trim().length > 0) {
              // Show the message text if available
              onChunk(extractedMessage);
            } else {
              // Otherwise show processing status
              onChunk(AI_STATUS_MESSAGES.PROCESSING_REQUEST);
            }
          }
          // Don't continue streaming - wait for complete response
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
      const { maxTokens, temperature } = getModelOptimizations(currentModel);

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

      // Deduct credits for streaming API call only if it actually costs money
      // Only deduct if: stream completed successfully with valid content
      // If streaming failed, generateTextStreaming would have thrown an error before we reach here
      const streamingText = result?.text || result?.response || fullText || "";
      const streamingHasValidContent =
        streamingText.trim().length > 0 &&
        streamingText !== "No response generated.";
      // For streaming, usage data is usually null, so we check if stream completed with content
      // If the stream completed and we have content, it means tokens were consumed = costs money
      const streamingHasContent = fullText.trim().length > 0;
      // Check for usage data if available (some providers include it even for streaming)
      const streamingHasUsageData =
        result?.usage &&
        (result.usage.prompt_tokens > 0 ||
          result.usage.completion_tokens > 0 ||
          result.usage.total_tokens > 0);

      // Only deduct if we have valid content AND (usage data OR stream completed with content)
      // For streaming, if we have content, tokens were consumed = costs money
      if (
        userId &&
        streamingHasValidContent &&
        (streamingHasUsageData || streamingHasContent)
      ) {
        const deductionResult = await checkAndDeductAICredits(userId);
        if (!deductionResult.success) {
          logger.error(
            `Failed to deduct credits for streaming API call for user ${userId}: ${deductionResult.error}`,
          );
          // Continue anyway - don't fail the request, but log the error
        } else {
          logger.debug(
            `Deducted ${deductionResult.creditsDeducted} Core for streaming API call (${deductionResult.creditsRemaining} remaining)`,
          );
        }
      } else if (userId && !streamingHasValidContent) {
        logger.warn(
          `Skipping credit deduction for streaming for user ${userId}: Stream returned empty or invalid content`,
        );
      }

      finalCallback();

      // Parse JSON response if needed (same as non-streaming)
      const rawResponseText = result.text || fullText;
      const parsed = jsonParser.parseJsonResponse(rawResponseText);

      // Log raw response for debugging
      logger.debug(
        `[generateResponseStreaming] Raw response (${rawResponseText.length} chars): ${rawResponseText.substring(0, 300)}${rawResponseText.length > 300 ? "..." : ""}`,
      );

      // Post-processing: If JSON has empty actions, treat as plain text
      let finalMessage = parsed.success
        ? typeof parsed.data.message === "string"
          ? parsed.data.message
          : String(parsed.data.message || "")
        : "";
      let finalActions = parsed.success
        ? Array.isArray(parsed.data.actions)
          ? parsed.data.actions
          : []
        : [];

      // Fallback: If parsing failed but we detected actions during streaming,
      // try to extract actions manually from raw text
      if (
        !parsed.success &&
        hasDetectedActions &&
        rawResponseText.trim().startsWith("{")
      ) {
        logger.warn(
          `[generateResponseStreaming] JSON parsing failed but actions detected - attempting manual extraction`,
        );
        try {
          // Try to extract actions array using regex as fallback
          const actionsMatch = rawResponseText.match(
            /"actions"\s*:\s*\[([\s\S]*?)\]/,
          );
          if (actionsMatch) {
            // Try to parse just the actions array
            const actionsJson = `[${actionsMatch[1]}]`;
            // Strip comments from actions JSON
            const cleanedActionsJson = actionsJson
              .replace(/\/\/.*$/gm, "")
              .replace(/\/\*[\s\S]*?\*\//g, "");
            const extractedActions = JSON.parse(cleanedActionsJson);
            if (
              Array.isArray(extractedActions) &&
              extractedActions.length > 0
            ) {
              finalActions = extractedActions;
              // Try to extract message field
              const messageMatch = rawResponseText.match(
                /"message"\s*:\s*"([^"]*)"|"message"\s*:\s*""/,
              );
              if (messageMatch) {
                finalMessage = messageMatch[1] || "";
              }
              logger.info(
                `[generateResponseStreaming] Successfully extracted ${finalActions.length} action(s) from raw text`,
              );
            }
          }
        } catch (fallbackError) {
          logger.warn(
            `[generateResponseStreaming] Fallback extraction failed: ${fallbackError.message}`,
          );
        }
      }

      // If we still don't have a message and parsing failed, use raw text
      if (!finalMessage && !parsed.success) {
        finalMessage = rawResponseText;
      }

      // Log what we detected
      logger.info(
        `[generateResponseStreaming] Parsed response - JSON: ${parsed.success}, Actions: ${finalActions.length}, Detected during streaming: ${hasDetectedActions}`,
      );
      if (finalActions.length > 0) {
        logger.info(
          `[generateResponseStreaming] Action details: ${JSON.stringify(finalActions)}`,
        );
      }

      // If actions were detected during streaming, we already showed a status message
      // Now that we have the complete response, update with the final message (if different)
      if (hasDetectedActions && onChunk) {
        // Only update if we have a message and it's different from what we might have shown
        if (finalMessage && finalMessage.trim().length > 0) {
          onChunk(finalMessage);
        }
        // If message is empty, the status message we showed earlier is fine
        // Commands will send their own responses, so no need to update again
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
