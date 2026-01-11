/**
 * Configuration Module Index
 * Centralized exports for all configuration files
 *
 * This file provides a single entry point for importing configuration
 * from the config directory, making imports cleaner and more maintainable.
 */

// Main configuration (Discord, database, Core pricing, etc.)
export { config } from "./config.js";
export { default as configDefault } from "./config.js";

// AI configuration (models, feature credits, content filters)
export {
  getAIModels,
  getAIFeatureCosts,
  getAvatarContentFilter,
  getAIConfig,
} from "./ai.js";
export { default as aiConfig } from "./ai.js";

// Theme configuration
export {
  THEME,
  UI_COMPONENTS,
  THEME_COLOR,
  BUTTON_STYLES,
  EMOJIS,
} from "./theme.js";

// Prompt configuration (now organized in prompts/ directory)
export {
  PROVIDER_PROMPTS,
  BASE_PROMPT_TEMPLATE,
  PROMPT_SUFFIX,
  NEGATIVE_PROMPT,
  DEFAULT_CHARACTER,
  CHARACTER_TYPE_ENHANCEMENTS,
  STYLE_MODIFIERS,
  CHAT_PROMPTS,
} from "./prompts/index.js";

// Emoji configuration
export { emojiConfig } from "./emojis.js";
export { default as emojiConfigDefault } from "./emojis.js";
