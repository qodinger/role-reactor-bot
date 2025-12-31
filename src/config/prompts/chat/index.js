/**
 * Chat Prompts Index
 * Centralized exports for all chat-related prompts
 */

import { criticalRules, generalGuidelinesBase } from "./system.js";

import { capabilitiesBase, commandExecutionRestriction } from "./commands.js";

import { followUpTemplate } from "./responses.js";

// Export individual prompts
export {
  criticalRules,
  generalGuidelinesBase,
  capabilitiesBase,
  commandExecutionRestriction,
  followUpTemplate,
};

/**
 * Combined CHAT_PROMPTS object for backward compatibility
 */
export const CHAT_PROMPTS = {
  // System prompts
  criticalRules,
  generalGuidelinesBase,

  // Command prompts
  capabilitiesBase,
  commandExecutionRestriction,

  // Response templates
  followUpTemplate,
};
