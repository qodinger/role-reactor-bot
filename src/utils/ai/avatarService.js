import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../config/prompts.js");
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
   * @param {Object} styleOptions - Optional style overrides
   * @param {string} styleOptions.colorStyle - Color style override
   * @param {string} styleOptions.mood - Mood style override
   * @param {string} styleOptions.artStyle - Art style override
   * @param {Function} progressCallback - Optional progress callback function
   * @returns {Promise<Object>} Generated avatar data
   */
  async generateAvatar(
    prompt,
    showDebugPrompt = false,
    userId = "unknown",
    styleOptions = {},
    progressCallback = null,
  ) {
    const requestId = `avatar_${userId}_${Date.now()}`;
    const startTime = Date.now();

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Step 1: Initialize
          if (progressCallback) progressCallback("Initializing AI service...");

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

          // Step 2: Build enhanced prompt
          if (progressCallback) progressCallback("Building enhanced prompt...");

          // Determine provider for prompt optimization
          const targetProvider = this.aiService.config.primary;
          const enhancedPrompt = await this.buildAnimePrompt(
            prompt,
            styleOptions,
            targetProvider,
          );

          logger.info(`Generating AI avatar for user ${userId}: "${prompt}"`);
          logger.debug(`Enhanced prompt: "${enhancedPrompt}"`);

          if (showDebugPrompt) {
            return {
              enhancedPrompt,
              originalPrompt: prompt,
            };
          }

          // Step 3: Connect to AI provider
          if (progressCallback)
            progressCallback("Connecting to AI provider...");

          // Step 4: Generate image
          if (progressCallback)
            progressCallback("Generating image (this may take 30-60s)...");
          const result = await this.aiService.generate({
            type: "image",
            prompt: enhancedPrompt,
            config: {
              size: "1024x1024",
              quality: "standard",
              userId, // Pass userId for rate limiting
            },
          });

          // Step 5: Process image data
          if (progressCallback) progressCallback("Processing image data...");

          const processingTime = Date.now() - startTime;
          logger.info(
            `Avatar generation completed in ${processingTime}ms for user ${userId}`,
          );

          // Step 6: Finalize result
          if (progressCallback) progressCallback("Finalizing result...");

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
   * @param {Object} styleOptions - Optional style overrides
   * @returns {Promise<string>} Enhanced prompt
   */
  async buildAnimePrompt(
    userPrompt,
    styleOptions = {},
    provider = "stability",
  ) {
    const config = await loadPromptConfig();

    // Use original prompt or default character if empty
    const baseDescription = userPrompt?.trim() || config.DEFAULT_CHARACTER;

    const enhancements = this.extractEnhancements(
      userPrompt,
      config,
      styleOptions,
    );

    // Get provider-specific prompt template
    const providerConfig = config.PROVIDER_PROMPTS?.[provider];
    if (!providerConfig) {
      logger.warn(
        `Provider ${provider} not found in PROVIDER_PROMPTS, falling back to stability`,
      );
    }
    const finalConfig = providerConfig || config.PROVIDER_PROMPTS.stability;

    // Build prompt based on provider type
    let prompt;
    if (provider === "openrouter") {
      // OpenRouter uses conversational format
      prompt = finalConfig.base.replace(
        "{characterDescription}",
        baseDescription,
      );

      // Add enhancements as additional instructions
      const enhancementParts = [
        enhancements.characterType,
        enhancements.colorStyle,
        enhancements.moodStyle,
        enhancements.artStyle,
      ]
        .filter(Boolean)
        .filter(part => part.trim() !== "")
        .map(part => part.trim());

      if (enhancementParts.length > 0) {
        prompt += ` ${enhancementParts.join(" ")}`;
      }

      prompt += ` ${finalConfig.suffix}`;
    } else if (provider === "openai") {
      // OpenAI uses descriptive format
      prompt = finalConfig.base.replace(
        "{characterDescription}",
        baseDescription,
      );

      // Add enhancements as additional descriptions
      const enhancementParts = [
        enhancements.characterType,
        enhancements.colorStyle,
        enhancements.moodStyle,
        enhancements.artStyle,
      ]
        .filter(Boolean)
        .filter(part => part.trim() !== "")
        .map(part => part.trim());

      if (enhancementParts.length > 0) {
        prompt += ` ${enhancementParts.join(" ")}`;
      }

      prompt += ` ${finalConfig.suffix}`;
    } else {
      // Stability AI uses comma-separated format
      const parts = [
        finalConfig.base.replace("{characterDescription}", baseDescription),
        enhancements.characterType,
        enhancements.colorStyle,
        enhancements.moodStyle,
        enhancements.artStyle,
        finalConfig.suffix,
      ]
        .filter(Boolean)
        .filter(part => part && part.trim() !== "")
        .map(part => part.trim());

      prompt = parts.join(", ");
    }

    return prompt;
  }

  /**
   * Extract comprehensive enhancements from user prompt
   * @param {string} userPrompt - User's original prompt
   * @param {Object} config - Prompt configuration
   * @returns {Object} Enhancement object with character type, color, mood, and art style
   */
  extractEnhancements(userPrompt, config, styleOptions = {}) {
    if (!userPrompt?.trim()) {
      return {
        characterType: "",
        colorStyle: "",
        moodStyle: "",
        artStyle: "",
      };
    }

    const description = userPrompt.toLowerCase();
    const enhancements = {
      characterType: "",
      colorStyle: "",
      moodStyle: "",
      artStyle: "",
    };

    // Extract character type enhancements with priority order
    const characterKeywords = [
      // Higher priority - more specific terms first
      { type: "female", keywords: ["woman", "lady", "female"] },
      { type: "male", keywords: ["man", "guy", "dude", "male"] },
      { type: "girl", keywords: ["girl", "young female", "teenage girl"] },
      { type: "boy", keywords: ["boy", "young male", "teenage boy"] },
      { type: "character", keywords: ["character", "persona", "protagonist"] },
      { type: "person", keywords: ["person", "human", "individual"] },
      { type: "avatar", keywords: ["avatar", "profile", "picture"] },
    ];

    for (const { type, keywords } of characterKeywords) {
      if (keywords.some(keyword => description.includes(keyword))) {
        enhancements.characterType = config.CHARACTER_TYPE_ENHANCEMENTS[type];
        break;
      }
    }

    // Extract color style preferences
    for (const [color, style] of Object.entries(
      config.STYLE_MODIFIERS?.colors || {},
    )) {
      if (description.includes(color)) {
        enhancements.colorStyle = style;
        break;
      }
    }

    // Extract mood preferences
    for (const [mood, style] of Object.entries(
      config.STYLE_MODIFIERS?.moods || {},
    )) {
      if (description.includes(mood)) {
        enhancements.moodStyle = style;
        break;
      }
    }

    // Extract art style preferences
    for (const [style, description] of Object.entries(
      config.STYLE_MODIFIERS?.art_styles || {},
    )) {
      if (userPrompt.toLowerCase().includes(style)) {
        enhancements.artStyle = description;
        break;
      }
    }

    // Override with explicit style options if provided
    if (
      styleOptions.colorStyle &&
      config.STYLE_MODIFIERS?.colors?.[styleOptions.colorStyle]
    ) {
      enhancements.colorStyle =
        config.STYLE_MODIFIERS.colors[styleOptions.colorStyle];
    }

    if (
      styleOptions.mood &&
      config.STYLE_MODIFIERS?.moods?.[styleOptions.mood]
    ) {
      enhancements.moodStyle = config.STYLE_MODIFIERS.moods[styleOptions.mood];
    }

    if (
      styleOptions.artStyle &&
      config.STYLE_MODIFIERS?.art_styles?.[styleOptions.artStyle]
    ) {
      enhancements.artStyle =
        config.STYLE_MODIFIERS.art_styles[styleOptions.artStyle];
    }

    return enhancements;
  }
}

export const avatarService = new AvatarService();
export const generateAvatar = (
  prompt,
  showDebugPrompt,
  userId,
  styleOptions,
  progressCallback,
) =>
  avatarService.generateAvatar(
    prompt,
    showDebugPrompt,
    userId,
    styleOptions,
    progressCallback,
  );
export const buildAnimePrompt = (userPrompt, styleOptions) =>
  avatarService.buildAnimePrompt(userPrompt, styleOptions);
