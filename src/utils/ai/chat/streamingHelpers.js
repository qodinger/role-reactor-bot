import { STREAMING_UPDATE_INTERVAL } from "../constants.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";

/**
 * Get optimized parameters for a specific model
 * @param {string|null} modelName - Model name/identifier
 * @returns {Object} Optimized parameters { maxTokens, temperature }
 */
function getModelOptimizations(modelName) {
  if (!modelName) {
    return { maxTokens: 2000, temperature: 0.7 };
  }

  const modelLower = modelName.toLowerCase();

  // DeepSeek models
  if (modelLower.includes("deepseek-r2")) {
    return { maxTokens: 1800, temperature: 0.5 };
  }
  if (modelLower.includes("deepseek-r1-0528")) {
    return { maxTokens: 2000, temperature: 0.5 };
  }
  if (modelLower.includes("deepseek-r1")) {
    return { maxTokens: 1500, temperature: 0.5 };
  }
  if (
    modelLower.includes("deepseek-chat") ||
    modelLower.includes("deepseek-v3")
  ) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("deepseek")) {
    return { maxTokens: 2000, temperature: 0.6 };
  }

  // Claude models
  if (
    modelLower.includes("claude-3.5-haiku") ||
    modelLower.includes("claude-3-haiku")
  ) {
    return { maxTokens: 2000, temperature: 0.6 };
  }
  if (
    modelLower.includes("claude-3.5-sonnet") ||
    modelLower.includes("claude-3-sonnet")
  ) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("claude")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }

  // GPT models
  if (modelLower.includes("gpt-4o-mini") || modelLower.includes("gpt-4-mini")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("gpt-4o") || modelLower.includes("gpt-4-turbo")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("gpt-4")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("gpt-3.5-turbo")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }
  if (modelLower.includes("gpt")) {
    return { maxTokens: 2000, temperature: 0.7 };
  }

  // Self-hosted models
  if (modelLower.includes("llama") || modelLower.includes("ollama")) {
    return { maxTokens: 1500, temperature: 0.6 };
  }

  // Default fallback
  return { maxTokens: 2000, temperature: 0.7 };
}
import { getLogger } from "../../logger.js";
import { performanceMonitor } from "../performanceMonitor.js";

const logger = getLogger();

/**
 * Setup streaming callbacks (chunk and final)
 * @param {Function} onChunk - Chunk callback
 * @returns {{chunkCallback: Function, finalCallback: Function, state: {fullText: string, lastUpdateTime: number, hasDetectedActions: boolean}}}
 */
export function setupStreamingCallbacks(onChunk) {
  const state = {
    fullText: "",
    lastUpdateTime: Date.now(),
    hasDetectedActions: false,
  };

  const chunkCallback = chunk => {
    state.fullText += chunk;

    // Check if response contains actions (JSON format with actions array)
    // If actions are detected, don't stream updates - wait for complete response
    if (!state.hasDetectedActions) {
      // Quick check: if response starts with JSON or contains "actions" field, likely has actions
      const trimmed = state.fullText.trim();
      if (
        trimmed.startsWith("{") ||
        trimmed.startsWith("```json") ||
        /"actions"\s*:\s*\[/.test(state.fullText)
      ) {
        state.hasDetectedActions = true;
        logger.debug(
          "[generateResponseStreaming] Detected actions in response - disabling streaming updates",
        );
        // Show a status message that we're processing actions
        if (onChunk) {
          // Try to extract any message text that might be in the JSON so far
          const messageMatch = state.fullText.match(
            /"message"\s*:\s*"([^"]*)"/,
          );
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
    if (!state.hasDetectedActions) {
      // Throttle Discord updates (update every STREAMING_UPDATE_INTERVAL ms)
      const now = Date.now();
      if (now - state.lastUpdateTime >= STREAMING_UPDATE_INTERVAL) {
        onChunk(state.fullText); // Send accumulated text
        state.lastUpdateTime = now;
      }
    }
  };

  // Final callback to ensure last chunk is sent
  const finalCallback = () => {
    // If actions were detected, we'll update with final message after parsing
    // Otherwise, send the final accumulated text
    if (state.fullText && !state.hasDetectedActions) {
      onChunk(state.fullText);
    }
  };

  return { chunkCallback, finalCallback, state };
}

/**
 * Perform streaming generation
 * @param {Object} aiService - AI service instance
 * @param {Array} messages - Messages array
 * @param {string} textProvider - Text provider name
 * @param {Function} chunkCallback - Chunk callback
 * @returns {Promise<Object>} Streaming result
 */
export async function performStreamingGeneration(
  aiService,
  messages,
  textProvider,
  chunkCallback,
) {
  // Get the current model for optimization using feature-based config
  let currentModel = null;

  if (textProvider && aiService.providerManager) {
    currentModel = aiService.providerManager.getModelForFeature("aiChat");
  }

  // Fallback to old structure if new structure not available
  if (!currentModel) {
    currentModel =
      aiService.config.providers?.openrouter?.models?.text?.primary ||
      aiService.config.providers?.openai?.models?.text?.primary ||
      aiService.config.providers?.selfhosted?.models?.text?.primary;
  }

  // Optimize parameters based on model characteristics
  const { maxTokens, temperature } = getModelOptimizations(currentModel);

  const result = await aiService.generateTextStreaming({
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

  return result;
}

/**
 * Process streaming response (parse, handle actions, update history)
 * @param {Object} result - Streaming result
 * @param {Object} state - Streaming state (fullText, hasDetectedActions)
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} userMessage - User's message
 * @param {Function} onChunk - Chunk callback
 * @param {string} textProvider - Text provider name
 * @param {number} requestStartTime - Request start timestamp
 * @param {Function} parseAIResponseFunc - Function to parse AI response
 * @param {Function} deductCreditsFunc - Function to deduct credits
 * @param {Function} addToHistory - Function to add to history
 * @returns {Promise<Object>} Final response with text and actions
 */
export async function processStreamingResponse(
  result,
  state,
  userId,
  guildId,
  userMessage,
  onChunk,
  textProvider,
  requestStartTime,
  parseAIResponseFunc,
  deductCreditsFunc,
  addToHistory,
) {
  // Deduct credits for streaming API call only if it actually costs money
  await deductCreditsFunc(userId, result, "streaming", state.fullText);

  // Parse JSON response if needed (same as non-streaming)
  const rawResponseText = result.text || state.fullText;

  // Log raw response for debugging
  logger.debug(
    `[generateResponseStreaming] Raw response (${rawResponseText.length} chars): ${rawResponseText.substring(0, 300)}${rawResponseText.length > 300 ? "..." : ""}`,
  );

  // Parse response using centralized method
  const parsed = parseAIResponseFunc(rawResponseText, state.hasDetectedActions);
  let finalMessage = parsed.message;
  const finalActions = parsed.actions;

  // If we still don't have a message and parsing failed, use raw text
  if (!finalMessage && !parsed.success) {
    finalMessage = rawResponseText;
  }

  // Log what we detected
  logger.info(
    `[generateResponseStreaming] Parsed response - JSON: ${parsed.success}, Actions: ${finalActions.length}, Detected during streaming: ${state.hasDetectedActions}`,
  );
  if (finalActions.length > 0) {
    logger.info(
      `[generateResponseStreaming] Action details: ${JSON.stringify(finalActions)}`,
    );
  }

  // If actions were detected during streaming, we already showed a status message
  // Now that we have the complete response, update with the final message (if different)
  if (state.hasDetectedActions && onChunk) {
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
  await addToHistory(userId, guildId, {
    role: "user",
    content: userMessage,
  });
  await addToHistory(userId, guildId, {
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
}
