// Simple inline JSON parser (replaces deleted jsonParser)
const jsonParser = {
  parseJsonResponse: rawResponse => {
    try {
      const parsed = JSON.parse(rawResponse);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// Simple inline response validator (replaces deleted responseValidator)
const responseValidator = {
  sanitizeData: data => {
    if (typeof data !== "string") return data;
    return data.replace(/[<>@#&]/g, "").trim();
  },
  validateResponseData: (_response, _guild) => {
    return { valid: true, warnings: [] };
  },
};
import {
  checkAndDeductAICredits,
  deductCreditsFromUsage,
} from "../aiCreditManager.js";
import { MAX_RESPONSE_LENGTH } from "../constants.js";
import { getLogger } from "../../logger.js";

const logger = getLogger();

/**
 * Parse AI response (JSON or plain text)
 * Handles JSON parsing, action extraction, and fallback logic
 * @param {string} rawResponse - Raw response text from AI
 * @param {boolean} hasDetectedActions - Whether actions were detected during streaming (for fallback)
 * @returns {Object} Parsed response with message and actions
 */
export function parseAIResponse(rawResponse, hasDetectedActions = false) {
  const parseResult = jsonParser.parseJsonResponse(rawResponse);

  if (parseResult.success) {
    // JSON format detected
    let finalMessage =
      typeof parseResult.data.message === "string"
        ? parseResult.data.message
        : String(parseResult.data.message || "");
    const actions = Array.isArray(parseResult.data.actions)
      ? parseResult.data.actions
      : [];

    // Post-processing: If actions array is empty, convert to plain text format
    if (actions.length === 0) {
      logger.debug(
        `[AI] JSON format with empty actions - converting to plain text`,
      );
    }

    // If parsed message is "No response generated" (fallback), treat it as empty
    if (
      finalMessage === "No response generated." ||
      finalMessage.trim() === ""
    ) {
      finalMessage = "";
    }

    // Log parsed JSON structure (debug level)
    if (actions.length > 0) {
      logger.debug(`[AI] Parsed JSON response with ${actions.length} actions`);
    }

    return { success: true, message: finalMessage, actions };
  } else {
    // Plain text format - no actions
    let finalMessage = rawResponse.trim();
    let actions = [];

    // Fallback: If parsing failed but we detected actions during streaming,
    // try to extract actions manually from raw text
    if (
      !parseResult.success &&
      hasDetectedActions &&
      rawResponse.trim().startsWith("{")
    ) {
      logger.warn(
        `[AI] JSON parsing failed but actions detected - attempting manual extraction`,
      );
      try {
        // Try to extract actions array using regex as fallback
        const actionsMatch = rawResponse.match(
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
          if (Array.isArray(extractedActions) && extractedActions.length > 0) {
            actions = extractedActions;
            // Try to extract message field
            const messageMatch = rawResponse.match(
              /"message"\s*:\s*"([^"]*)"|"message"\s*:\s*""/,
            );
            if (messageMatch) {
              finalMessage = messageMatch[1] || "";
            }
            logger.info(
              `[AI] Successfully extracted ${actions.length} action(s) from raw text`,
            );
          }
        }
      } catch (fallbackError) {
        logger.warn(
          `[AI] Fallback extraction failed: ${fallbackError.message}`,
        );
      }
    }

    logger.debug(`[AI] Plain text response (no actions)`);
    return { success: false, message: finalMessage, actions };
  }
}

/**
 * Validate and sanitize AI response
 * @param {string} response - AI response text
 * @param {import('discord.js').Guild} guild - Discord guild (optional)
 * @param {boolean} isJsonResponse - Whether response is from JSON parsing
 * @returns {string} Validated and sanitized response
 */
export function validateAndSanitizeResponse(response, guild, isJsonResponse) {
  // Handle null/undefined/empty responses
  if (!response || typeof response !== "string") {
    return response || "";
  }

  // Validate response data accuracy (only for plain text responses)
  if (guild && !isJsonResponse) {
    const validation = responseValidator.validateResponseData(response, guild);
    if (!validation.valid || validation.warnings.length > 0) {
      logger.warn(
        `[AI] Data validation warnings: ${validation.warnings.length} issue(s)`,
      );
      validation.warnings.forEach(warning => {
        logger.debug(`[AI] Validation: ${warning}`);
      });
    }

    // Check for placeholder data usage
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
      response.includes(pattern),
    );
    if (usedPlaceholders) {
      logger.error(
        `[AI] CRITICAL: Response contains placeholder patterns instead of real data`,
      );
    }
  }

  // Sanitize response
  const beforeSanitize = response;
  let sanitized = responseValidator.sanitizeData(response);

  // Check response length
  if (sanitized && sanitized.length > MAX_RESPONSE_LENGTH) {
    logger.warn(
      `[AI] Response exceeds max length (${sanitized.length} > ${MAX_RESPONSE_LENGTH}), truncating`,
    );
    sanitized = `${sanitized.substring(0, MAX_RESPONSE_LENGTH - 3)}...`;
  }

  // Log sanitization
  if (beforeSanitize !== sanitized) {
    logger.debug(`[AI] Response was sanitized (sensitive data removed)`);
  }

  return sanitized;
}

/**
 * Deduct credits for an API call based on actual usage when available
 * Uses usage-based deduction for providers that return cost info (OpenRouter)
 * Falls back to fixed deduction for other providers
 * @param {string} userId - User ID
 * @param {Object} result - API result object
 * @param {string} callType - Type of call: 'initial', 're-query', 'streaming'
 * @param {string} fallbackText - Fallback text for streaming (fullText)
 * @returns {Promise<void>}
 */
export async function deductCreditsIfNeeded(
  userId,
  result,
  callType,
  fallbackText = "",
) {
  if (!userId) return;

  const responseText = result?.text || result?.response || fallbackText || "";
  const hasValidContent =
    responseText.trim().length > 0 && responseText !== "No response generated.";

  // Should deduct if we have valid content (API call succeeded and generated content)
  const shouldDeduct = hasValidContent;

  if (!shouldDeduct) {
    if (!hasValidContent) {
      logger.warn(
        `Skipping credit deduction for ${callType} for user ${userId}: API call returned empty or invalid content`,
      );
    }
    return;
  }

  // Use usage-based deduction if we have actual usage data from the provider
  if (
    result?.usage &&
    typeof result.usage.cost === "number" &&
    result.usage.cost > 0
  ) {
    logger.info(
      `💰 Using usage-based deduction for ${callType} (${result.provider || "unknown"}) - API usage: ${result.usage.cost} credits`,
    );

    // Get provider-specific conversion rate
    const provider = result.provider || "unknown";
    let conversionRate = 2.0; // Default conversion rate

    try {
      const { getAIFeatureCosts } = await import("../../../config/ai.js");
      const featureCosts = getAIFeatureCosts();

      if (featureCosts.tokenPricing && featureCosts.tokenPricing[provider]) {
        const providerPricing = featureCosts.tokenPricing[provider];
        conversionRate = providerPricing.conversionRate || 2.0;
        // Note: minimumCharge is available in config but not used in current implementation
      }
    } catch (error) {
      logger.debug(
        "Failed to load token pricing config, using defaults:",
        error,
      );
    }

    const deductionResult = await deductCreditsFromUsage(
      userId,
      result.usage,
      provider,
      result.model || "unknown",
      conversionRate,
    );

    if (!deductionResult.success) {
      logger.error(
        `Failed to deduct usage-based credits for ${callType} API call for user ${userId}: ${deductionResult.error}`,
      );
    } else {
      logger.info(
        `✅ Deducted ${deductionResult.creditsDeducted.toFixed(2)} Core based on actual usage (${deductionResult.creditsRemaining.toFixed(2)} remaining)`,
      );
    }
    return;
  }

  // Fallback to fixed deduction for providers without usage data
  logger.debug(
    `Using fixed deduction for ${callType} (${result?.provider || "unknown"}) - provider uses fixed costs per request`,
  );

  const deductionResult = await checkAndDeductAICredits(userId);
  if (!deductionResult.success) {
    logger.error(
      `Failed to deduct credits for ${callType} API call for user ${userId}: ${deductionResult.error}`,
    );
    // Continue anyway - don't fail the request, but log the error
  } else {
    logger.debug(
      `Deducted ${deductionResult.creditsDeducted.toFixed(2)} Core for ${callType} API call (${deductionResult.creditsRemaining.toFixed(2)} remaining)`,
    );
  }
}
