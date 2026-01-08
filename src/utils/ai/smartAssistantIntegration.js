/**
 * Smart Assistant Integration
 *
 * Simple integration that can be easily enabled/disabled and doesn't
 * interfere with existing functionality.
 */

import { getLogger } from "../logger.js";
import { smartAssistant } from "./smartAssistant.js";
import { chatService } from "./chatService.js";

const logger = getLogger();

/**
 * Configuration for smart assistant
 */
const SMART_ASSISTANT_CONFIG = {
  enabled: process.env.SMART_ASSISTANT_ENABLED === "true", // Disabled by default
  fallbackOnError: true, // Always fallback to regular chat on error
  debugMode: process.env.NODE_ENV === "development",
};

/**
 * Process message with optional smart assistance
 *
 * This function can be used as a drop-in replacement for chatService.generateResponse
 * It will use smart assistance if enabled, otherwise falls back to regular chat.
 */
export async function processMessageWithSmartAssistance(
  userMessage,
  guild,
  client,
  options = {},
) {
  // If smart assistant is disabled, use regular chat service
  if (!SMART_ASSISTANT_CONFIG.enabled) {
    if (SMART_ASSISTANT_CONFIG.debugMode) {
      logger.debug("[SmartAssistant] Disabled - using regular chat service");
    }
    return await chatService.generateResponse(
      userMessage,
      guild,
      client,
      options,
    );
  }

  try {
    // Try smart assistant first
    if (SMART_ASSISTANT_CONFIG.debugMode) {
      logger.debug("[SmartAssistant] Processing with smart assistance");
    }

    const response = await smartAssistant.processMessage(
      userMessage,
      guild,
      client,
      options,
    );

    if (SMART_ASSISTANT_CONFIG.debugMode) {
      logger.debug("[SmartAssistant] Smart processing successful");
    }

    return response;
  } catch (error) {
    logger.warn(
      "[SmartAssistant] Smart processing failed, falling back to regular chat:",
      error.message,
    );

    // Always fallback to regular chat service on error
    if (SMART_ASSISTANT_CONFIG.fallbackOnError) {
      return await chatService.generateResponse(
        userMessage,
        guild,
        client,
        options,
      );
    } else {
      throw error;
    }
  }
}

/**
 * Enable smart assistant
 */
export function enableSmartAssistant() {
  SMART_ASSISTANT_CONFIG.enabled = true;
  logger.info("[SmartAssistant] Smart assistant enabled");
}

/**
 * Disable smart assistant
 */
export function disableSmartAssistant() {
  SMART_ASSISTANT_CONFIG.enabled = false;
  logger.info("[SmartAssistant] Smart assistant disabled");
}

/**
 * Check if smart assistant is enabled
 */
export function isSmartAssistantEnabled() {
  return SMART_ASSISTANT_CONFIG.enabled;
}

/**
 * Get smart assistant status
 */
export function getSmartAssistantStatus() {
  return {
    enabled: SMART_ASSISTANT_CONFIG.enabled,
    fallbackOnError: SMART_ASSISTANT_CONFIG.fallbackOnError,
    debugMode: SMART_ASSISTANT_CONFIG.debugMode,
    componentStatus: SMART_ASSISTANT_CONFIG.enabled
      ? smartAssistant.getComponentStatus()
      : null,
  };
}

export default {
  processMessageWithSmartAssistance,
  enableSmartAssistant,
  disableSmartAssistant,
  isSmartAssistantEnabled,
  getSmartAssistantStatus,
};
