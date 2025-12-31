/**
 * Prompt Configuration Index
 * Centralized exports for all prompt configurations
 *
 * This file provides a single entry point for importing prompts,
 * maintaining backward compatibility while allowing modular organization.
 */

// Image generation prompts
export {
  PROVIDER_PROMPTS,
  BASE_PROMPT_TEMPLATE,
  PROMPT_SUFFIX,
  NEGATIVE_PROMPT,
  DEFAULT_CHARACTER,
  CHARACTER_TYPE_ENHANCEMENTS,
  STYLE_MODIFIERS,
} from "./imagePrompts.js";

// Chat system prompts (now organized in chat/ subdirectory)
export { CHAT_PROMPTS } from "./chat/index.js";

// Dynamic prompt loader (for runtime loading and template substitution)
export {
  loadImagePrompts,
  loadChatPrompts,
  loadAllPrompts,
  getPrompt,
  clearPromptCache,
  getCacheStats,
} from "./promptLoader.js";

// Prompt versioning
export {
  PROMPT_VERSIONS,
  getPromptVersion,
  getAllPromptVersions,
} from "./promptVersion.js";

// Prompt analytics
export {
  trackPromptUsage,
  trackPromptPerformance,
  trackPromptError,
  getUsageStats,
  getPerformanceStats,
  getErrorStats,
  getAllAnalytics,
  resetAnalytics,
} from "./promptAnalytics.js";
