/**
 * Dynamic Prompt Loader
 * Provides runtime loading, caching, and template variable substitution for prompts
 */

import { getLogger } from "../../utils/logger.js";
import {
  trackPromptUsage,
  trackPromptPerformance,
  trackPromptError,
} from "./promptAnalytics.js";

const logger = getLogger();

// Cache for loaded prompts
let promptCache = {
  image: null,
  chat: null,
  lastLoadTime: null,
};

// Cache TTL (time to live) - reload prompts after this many milliseconds
const CACHE_TTL = process.env.PROMPT_CACHE_TTL
  ? parseInt(process.env.PROMPT_CACHE_TTL, 10)
  : 5 * 60 * 1000; // Default: 5 minutes

/**
 * Load image prompts dynamically with caching
 * @param {boolean} forceReload - Force reload even if cached
 * @returns {Promise<Object>} Image prompts object
 */
export async function loadImagePrompts(forceReload = false) {
  const now = Date.now();

  // Return cached version if still valid and not forcing reload
  if (
    !forceReload &&
    promptCache.image &&
    promptCache.lastLoadTime &&
    now - promptCache.lastLoadTime < CACHE_TTL
  ) {
    return promptCache.image;
  }

  const loadStart = Date.now();
  try {
    const imagePromptsModule = await import("./imagePrompts.js");
    promptCache.image = {
      PROVIDER_PROMPTS: imagePromptsModule.PROVIDER_PROMPTS,
      STYLE_MODIFIERS: imagePromptsModule.STYLE_MODIFIERS,
      CHARACTER_TYPE_ENHANCEMENTS:
        imagePromptsModule.CHARACTER_TYPE_ENHANCEMENTS,
      DEFAULT_CHARACTER: imagePromptsModule.DEFAULT_CHARACTER,
      BASE_PROMPT_TEMPLATE: imagePromptsModule.BASE_PROMPT_TEMPLATE,
      PROMPT_SUFFIX: imagePromptsModule.PROMPT_SUFFIX,
      NEGATIVE_PROMPT: imagePromptsModule.NEGATIVE_PROMPT,
    };
    promptCache.lastLoadTime = now;

    const loadTime = Date.now() - loadStart;
    trackPromptPerformance("image", loadTime);
    logger.debug(`Image prompts loaded successfully in ${loadTime}ms`);
    return promptCache.image;
  } catch (error) {
    trackPromptError("image", "load", error);
    logger.error("Failed to load image prompts:", error);
    // Return cached version if available, otherwise empty object
    return promptCache.image || {};
  }
}

/**
 * Load chat prompts dynamically with caching
 * @param {boolean} forceReload - Force reload even if cached
 * @returns {Promise<Object>} Chat prompts object
 */
export async function loadChatPrompts(forceReload = false) {
  const now = Date.now();

  // Return cached version if still valid and not forcing reload
  if (
    !forceReload &&
    promptCache.chat &&
    promptCache.lastLoadTime &&
    now - promptCache.lastLoadTime < CACHE_TTL
  ) {
    return promptCache.chat;
  }

  const loadStart = Date.now();
  try {
    const chatPromptsModule = await import("./chat/index.js");
    promptCache.chat = {
      CHAT_PROMPTS: chatPromptsModule.CHAT_PROMPTS,
    };
    promptCache.lastLoadTime = now;

    const loadTime = Date.now() - loadStart;
    trackPromptPerformance("chat", loadTime);
    logger.debug(`Chat prompts loaded successfully in ${loadTime}ms`);
    return promptCache.chat;
  } catch (error) {
    trackPromptError("chat", "load", error);
    logger.error("Failed to load chat prompts:", error);
    // Return cached version if available, otherwise empty object
    return promptCache.chat || { CHAT_PROMPTS: {} };
  }
}

/**
 * Load all prompts dynamically with caching
 * @param {boolean} forceReload - Force reload even if cached
 * @returns {Promise<Object>} All prompts object
 */
export async function loadAllPrompts(forceReload = false) {
  const [imagePrompts, chatPrompts] = await Promise.all([
    loadImagePrompts(forceReload),
    loadChatPrompts(forceReload),
  ]);

  return {
    ...imagePrompts,
    ...chatPrompts,
  };
}

/**
 * Get a specific prompt with template variable substitution
 * @param {string} promptType - Type of prompt ('image' or 'chat')
 * @param {string} promptKey - Key of the prompt (e.g., 'followUpTemplate', 'criticalRules')
 * @param {Object} variables - Variables to substitute in the prompt template
 * @param {boolean} forceReload - Force reload prompts
 * @returns {Promise<string>} Prompt with variables substituted
 */
export async function getPrompt(
  promptType,
  promptKey,
  variables = {},
  forceReload = false,
) {
  let prompts;
  let result = "";

  if (promptType === "image") {
    prompts = await loadImagePrompts(forceReload);
    // Handle nested keys like PROVIDER_PROMPTS.stability.base
    const keys = promptKey.split(".");
    let value = prompts;
    for (const key of keys) {
      value = value?.[key];
    }
    result = substituteVariables(value || "", variables);
  } else if (promptType === "chat") {
    prompts = await loadChatPrompts(forceReload);
    const prompt = prompts.CHAT_PROMPTS?.[promptKey] || "";
    result = substituteVariables(prompt, variables);
  }

  // Track usage
  if (result) {
    trackPromptUsage(promptType, promptKey);
  }

  return result;
}

/**
 * Substitute variables in a prompt template
 * Supports {variableName} syntax
 * @param {string} template - Template string with variables
 * @param {Object} variables - Variables to substitute
 * @returns {string} Template with variables substituted
 */
function substituteVariables(template, variables) {
  if (!template || typeof template !== "string") {
    return template || "";
  }

  let result = template;

  // Replace {variableName} with variable value
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    result = result.replace(regex, String(value));
  }

  // Replace any remaining {variableName} with empty string (or keep as-is if configured)
  if (process.env.PROMPT_STRICT_MODE === "true") {
    // In strict mode, warn about unsubstituted variables
    const remainingVars = result.match(/\{[^}]+\}/g);
    if (remainingVars && remainingVars.length > 0) {
      logger.warn(
        `Unsubstituted variables in prompt: ${remainingVars.join(", ")}`,
      );
    }
  } else {
    // In non-strict mode, remove unsubstituted variables
    result = result.replace(/\{[^}]+\}/g, "");
  }

  return result;
}

/**
 * Clear prompt cache (useful for hot-reloading)
 */
export function clearPromptCache() {
  promptCache = {
    image: null,
    chat: null,
    lastLoadTime: null,
  };
  logger.debug("Prompt cache cleared");
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    hasImageCache: !!promptCache.image,
    hasChatCache: !!promptCache.chat,
    lastLoadTime: promptCache.lastLoadTime,
    cacheAge: promptCache.lastLoadTime
      ? Date.now() - promptCache.lastLoadTime
      : null,
    cacheTTL: CACHE_TTL,
  };
}
