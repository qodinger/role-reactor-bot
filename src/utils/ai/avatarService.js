import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../config/aiPrompts.js");
  }
  return promptConfigCache;
}

const logger = getLogger();

/**
 * Specialized service for AI avatar generation
 */
export class AvatarService {
  constructor() {
    this.aiService = multiProviderAIService;
  }

  /**
   * Generate an AI avatar with enhanced prompts
   * @param {string} prompt - User's prompt
   * @param {boolean} showDebugPrompt - Show debug information
   * @param {string} userId - User ID for concurrency tracking
   * @returns {Promise<Object>} Generated avatar data
   */
  async generateAvatar(prompt, showDebugPrompt = false, userId = "unknown") {
    const requestId = `avatar_${userId}_${Date.now()}`;
    const startTime = Date.now();

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Validate input
          if (
            !prompt ||
            typeof prompt !== "string" ||
            prompt.trim().length === 0
          ) {
            throw new Error(
              "Invalid prompt: prompt must be a non-empty string",
            );
          }

          if (prompt.length > 500) {
            throw new Error("Prompt too long: maximum 500 characters allowed");
          }

          const enhancedPrompt = await this.buildAnimePrompt(prompt);

          logger.info(`Generating AI avatar for user ${userId}: "${prompt}"`);
          logger.debug(`Enhanced prompt: "${enhancedPrompt}"`);

          if (showDebugPrompt) {
            return {
              enhancedPrompt,
              originalPrompt: prompt,
            };
          }

          const result = await this.aiService.generate({
            type: "image",
            prompt: enhancedPrompt,
            config: {
              size: "1024x1024",
              quality: "standard",
            },
          });

          const processingTime = Date.now() - startTime;
          logger.info(
            `Avatar generation completed in ${processingTime}ms for user ${userId}`,
          );

          return {
            ...result,
            prompt: enhancedPrompt,
            processingTime,
          };
        } catch (error) {
          const processingTime = Date.now() - startTime;
          logger.error(
            `Avatar generation failed after ${processingTime}ms for user ${userId}:`,
            error,
          );

          // Provide more specific error messages
          if (error.message.includes("API error: 401")) {
            throw new Error("Authentication failed: Invalid API key");
          } else if (error.message.includes("API error: 429")) {
            throw new Error("Rate limit exceeded: Please try again later");
          } else if (error.message.includes("API error: 402")) {
            throw new Error("Payment required: Insufficient credits");
          } else if (error.message.includes("No image generated")) {
            throw new Error(
              "Image generation failed: Please try a different prompt",
            );
          } else {
            throw new Error(`Avatar generation failed: ${error.message}`);
          }
        }
      },
      { prompt, showDebugPrompt },
    );
  }

  /**
   * Build enhanced anime prompt with fixed template
   * @param {string} userPrompt - User's original prompt
   * @returns {Promise<string>} Enhanced prompt
   */
  async buildAnimePrompt(userPrompt) {
    const config = await loadPromptConfig();
    const characterDescription = this.parseUserPrompt(userPrompt, config);
    const colorPreference = this.extractColorPreference(userPrompt);

    // Build prompt more efficiently
    const parts = [
      config.BASE_PROMPT_TEMPLATE.replace(
        "{characterDescription}",
        characterDescription,
      ),
      colorPreference,
      config.PROMPT_SUFFIX,
    ].filter(Boolean);

    return parts.join(", ");
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
    if (!userPrompt?.trim()) {
      return ""; // No default color to avoid forcing backgrounds
    }

    const description = userPrompt.toLowerCase();

    // Use a more efficient color detection with regex
    const colorRegex =
      /\b(blue|red|yellow|green|purple|pink|orange|black|white|gray|grey|brown|violet|cyan|magenta|lime|navy|maroon|olive|teal|silver|gold)\b/;
    const match = description.match(colorRegex);

    return match ? match[1] : "";
  }
}

export const avatarService = new AvatarService();
export const generateAvatar = (prompt, showDebugPrompt, userId) =>
  avatarService.generateAvatar(prompt, showDebugPrompt, userId);
export const buildAnimePrompt = userPrompt =>
  avatarService.buildAnimePrompt(userPrompt);
