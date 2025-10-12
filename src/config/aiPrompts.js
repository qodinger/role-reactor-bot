/**
 * AI Prompt Configuration
 * This file contains sensitive prompt templates and should not be committed to public repositories.
 * Copy this file to aiPrompts.local.js and customize the prompts for your use case.
 */

// Base prompt template - fixed template for consistent anime style
export const BASE_PROMPT_TEMPLATE =
  process.env.AI_BASE_PROMPT_TEMPLATE ||
  "personal profile pic, {characterDescription}, unique style, looking at the viewer, character design, trendy japanese anime style, 80s style, lofi style, popular on artstation, sharpness, 8k, best quality, ultra detailed, sharpness, bold outline by tatsunoko, wabi-sabi, minimalism, pale pink and fluffy clouds like cotton, light blue";

// Prompt suffix - customize this for model-specific instructions
export const PROMPT_SUFFIX = process.env.AI_PROMPT_SUFFIX || " --niji 5";

// Default character description if user doesn't specify
export const DEFAULT_CHARACTER =
  process.env.AI_DEFAULT_CHARACTER || "an anime character";
