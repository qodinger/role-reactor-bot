import { aiService } from "./aiService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";

// Load prompt configuration
async function loadPromptConfig() {
  return await import("../../config/aiPrompts.js");
}

const logger = getLogger();

/**
 * Specialized service for AI avatar generation
 */
export class AvatarService {
  constructor() {
    this.aiService = aiService;
  }

  /**
   * Generate an AI avatar with enhanced prompts
   * @param {string} prompt - User's prompt
   * @param {string} style - Anime style
   * @param {string} mood - Character mood
   * @param {boolean} showDebugPrompt - Show debug information
   * @param {string} userId - User ID for concurrency tracking
   * @returns {Promise<Object>} Generated avatar data
   */
  async generateAvatar(
    prompt,
    style,
    mood,
    showDebugPrompt = false,
    userId = "unknown",
  ) {
    const requestId = `avatar_${userId}_${Date.now()}`;

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          const enhancedPrompt = await this.buildAnimePrompt(
            prompt,
            style,
            mood,
          );

          logger.info(`Generating AI avatar for user ${userId}: "${prompt}"`);
          logger.info(`Enhanced prompt: "${enhancedPrompt}"`);

          if (showDebugPrompt) {
            return {
              enhancedPrompt,
              originalPrompt: prompt,
              style,
              mood,
            };
          }

          const result = await this.aiService.generateImage(enhancedPrompt, {
            model: "google/gemini-2.5-flash-image-preview",
            aspect_ratio: "1:1",
            size: "1024x1024",
            quality: "standard",
          });

          return {
            ...result,
            prompt: enhancedPrompt,
            style,
            mood,
          };
        } catch (error) {
          logger.error("Error generating AI avatar:", error);
          throw new Error(`Avatar generation failed: ${error.message}`);
        }
      },
      { prompt, style, mood, showDebugPrompt },
    );
  }

  /**
   * Build enhanced anime prompt with fixed template
   * @param {string} userPrompt - User's original prompt
   * @param {string} _style - Unused (kept for compatibility)
   * @param {string} _mood - Unused (kept for compatibility)
   * @returns {Promise<string>} Enhanced prompt
   */
  async buildAnimePrompt(userPrompt, _style, _mood) {
    const config = await loadPromptConfig();
    const characterDescription = this.parseUserPrompt(userPrompt, config);
    const colorPreference = this.extractColorPreference(userPrompt);

    let finalPrompt = config.BASE_PROMPT_TEMPLATE.replace(
      "{characterDescription}",
      characterDescription,
    );

    if (colorPreference) {
      finalPrompt += `, ${colorPreference}`;
    }

    finalPrompt += config.PROMPT_SUFFIX;

    return finalPrompt;
  }

  /**
   * Parse user prompt to extract character description
   * @param {string} userPrompt - User's original prompt
   * @param {Object} config - Prompt configuration
   * @returns {string} Parsed character description
   */
  parseUserPrompt(userPrompt, _config) {
    if (!userPrompt || userPrompt.trim().length === 0) {
      return "a super cool girl"; // Default character for the template
    }

    let characterDesc = userPrompt.trim();

    // Check if user already specified character type
    const description = characterDesc.toLowerCase();
    const hasCharacterType =
      description.includes("boy") ||
      description.includes("man") ||
      description.includes("girl") ||
      description.includes("woman") ||
      description.includes("character") ||
      description.includes("person") ||
      description.includes("avatar") ||
      description.includes("profile");

    if (!hasCharacterType) {
      // Add default character type if not specified
      characterDesc = `a super cool ${characterDesc}`;
    }

    return characterDesc;
  }

  /**
   * Extract color preference from user prompt
   * @param {string} userPrompt - User's original prompt
   * @returns {string} Color preference
   */
  extractColorPreference(userPrompt) {
    if (!userPrompt || userPrompt.trim().length === 0) {
      return ""; // No default color to avoid forcing backgrounds
    }

    const description = userPrompt.toLowerCase();

    // Common color keywords
    const colorMap = {
      blue: "blue",
      red: "red",
      yellow: "yellow",
      green: "green",
      purple: "purple",
      pink: "pink",
      orange: "orange",
      black: "black",
      white: "white",
      gray: "gray",
      grey: "gray",
      brown: "brown",
      violet: "violet",
      cyan: "cyan",
      magenta: "magenta",
      lime: "lime",
      navy: "navy",
      maroon: "maroon",
      olive: "olive",
      teal: "teal",
      silver: "silver",
      gold: "gold",
    };

    for (const [color, value] of Object.entries(colorMap)) {
      if (description.includes(color)) {
        return value;
      }
    }

    return "";
  }
}

export const avatarService = new AvatarService();
export const generateAvatar = (prompt, style, mood, showDebugPrompt) =>
  avatarService.generateAvatar(prompt, style, mood, showDebugPrompt);
export const buildAnimePrompt = (userPrompt, style, mood) =>
  avatarService.buildAnimePrompt(userPrompt, style, mood);
