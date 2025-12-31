import { getModelOptimizations } from "../modelOptimizer.js";
import { performanceMonitor } from "../performanceMonitor.js";
import { getLogger } from "../../logger.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";

const logger = getLogger();

/**
 * Determine if user wants detailed response
 * @param {string} userMessage - User's message
 * @returns {boolean} True if user wants detailed response
 */
export function determineWantsDetail(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  return (
    lowerMessage.includes("explain") ||
    lowerMessage.includes("tell me more") ||
    lowerMessage.includes("in detail") ||
    lowerMessage.includes("elaborate") ||
    lowerMessage.includes("describe") ||
    lowerMessage.includes("how does") ||
    lowerMessage.includes("how do")
  );
}

/**
 * Generate AI response with model optimization
 * @param {Object} aiService - AI service instance
 * @param {Array} messages - Messages array
 * @param {string} systemMessage - System message
 * @param {string} userMessage - User message (for wantsDetail detection)
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{result: Object, wantsDetail: boolean}>}
 */
export async function generateAIResponseWithOptimization(
  aiService,
  messages,
  systemMessage,
  userMessage,
  requestId,
) {
  // Get model-specific optimizations
  const currentModel =
    aiService.config.providers.openrouter?.models?.text?.primary ||
    aiService.config.providers.openai?.models?.text?.primary ||
    aiService.config.providers.selfhosted?.models?.text?.primary;
  const modelOpts = getModelOptimizations(currentModel);

  // Determine maxTokens based on user's request and model capabilities
  const wantsDetail = determineWantsDetail(userMessage);
  const baseMaxTokens = modelOpts.maxTokens;
  const maxTokens = wantsDetail
    ? Math.min(baseMaxTokens, 1200) // Cap at 1200 for detailed responses
    : Math.min(Math.floor(baseMaxTokens * 0.4), 600); // ~40% of base for concise (capped at 600)

  // Log prompt summary (debug level for detailed logs)
  logger.debug(
    `[AI] Request ${requestId}: ${messages.length} messages, ${JSON.stringify(messages).length} chars`,
  );

  const result = await aiService.generate({
    type: "text",
    prompt: messages,
    config: {
      systemMessage,
      temperature: modelOpts.temperature, // Use model-optimized temperature
      maxTokens, // Adaptive: based on model and user preference
      forceJson: false, // Don't force JSON - let AI choose based on whether actions are needed
    },
  });

  return { result, wantsDetail };
}

/**
 * Process AI response (parse, validate, handle actions)
 * @param {Object} result - AI generation result
 * @param {string} userId - User ID
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {string} userMessage - User's message
 * @param {string} locale - User locale
 * @param {Object} options - Options with user, channel, wantsDetail, client
 * @param {string} guildId - Guild ID
 * @param {Object} services - Services object with parseAIResponse, validateAndSanitizeResponse, deductCreditsIfNeeded, processActionsAndReQuery
 * @returns {Promise<{finalResponse: string, responseSuppressed: boolean}>}
 */
export async function processAIResponse(
  result,
  userId,
  guild,
  userMessage,
  locale,
  options,
  guildId,
  services,
) {
  // Deduct credits for initial API call only if it actually costs money
  await services.deductCreditsIfNeeded(userId, result, "initial");

  const rawResponse =
    result.text || result.response || "No response generated.";

  // Log response summary (debug level for detailed logs)
  logger.debug(
    `[AI] Response: ${rawResponse.length} chars for user ${userId || "unknown"}`,
  );

  // Parse response - can be JSON (if actions) or plain text (if no actions)
  const parsed = services.parseAIResponse(rawResponse);
  let finalResponse = parsed.message;
  const actions = parsed.actions;

  // Validate and sanitize response
  finalResponse = services.validateAndSanitizeResponse(
    finalResponse,
    guild,
    parsed.success,
  );

  // Process actions and handle re-query if needed
  const actionContext = {
    guild,
    client: options.client,
    user: options.user,
    channel: options.channel,
    userId,
    guildId,
    userMessage,
    locale: locale || "en-US",
    wantsDetail: options.wantsDetail,
  };
  const actionResult = await services.processActionsAndReQuery(
    actions,
    finalResponse,
    actionContext,
  );
  finalResponse = actionResult.finalResponse;
  const responseSuppressed = actionResult.responseSuppressed;

  // Handle empty response fallback
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

  return { finalResponse, responseSuppressed };
}

/**
 * Finalize response (update history, record metrics)
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} finalResponse - Final response text
 * @param {boolean} responseSuppressed - Whether response was suppressed
 * @param {number} requestStartTime - Request start timestamp
 * @param {Function} updateConversationHistory - Function to update conversation history
 * @returns {Promise<Object>} Final response object
 */
export async function finalizeResponse(
  userId,
  guildId,
  finalResponse,
  responseSuppressed,
  requestStartTime,
  updateConversationHistory,
) {
  // Log final response
  logger.debug(`[AI] Final response: ${finalResponse.length} chars`);

  // Update conversation history and summary
  await updateConversationHistory(
    userId,
    guildId,
    finalResponse,
    responseSuppressed,
  );

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
}

/**
 * Setup queue status callback wrapper
 * @param {string} requestId - Request ID
 * @param {Function} onQueueStatus - Queue status callback
 * @param {Function} onStatus - Regular status callback
 * @returns {Function} Queue status callback wrapper
 */
export function setupQueueStatusCallback(requestId, onQueueStatus, onStatus) {
  // Helper to format queue status message (uses centralized status messages)
  const formatQueueStatus = (position, totalInSystem, waitTime) => {
    return AI_STATUS_MESSAGES.QUEUE_POSITION(position, totalInSystem, waitTime);
  };

  // Wrapper for queue status callback that also calls onStatus
  return (position, totalInSystem, waitTime) => {
    if (onQueueStatus) {
      // Pass requestId so handlers can show cancel button
      onQueueStatus(position, totalInSystem, waitTime, requestId);
    }
    // Also update regular status if provided
    if (onStatus) {
      const queueMessage = formatQueueStatus(position, totalInSystem, waitTime);
      if (queueMessage) {
        // Pass requestId for cancel button
        onStatus(queueMessage, requestId, position);
      } else if (position === null) {
        // Request is now processing (no cancel button needed)
        onStatus(AI_STATUS_MESSAGES.CRAFTING_RESPONSE, null, null);
      }
    }
  };
}
