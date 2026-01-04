import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { AI_STATUS_MESSAGES } from "./statusMessages.js";

let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    // Import imagePrompts directly since index.js was deleted
    promptConfigCache = await import("../../config/prompts/imagePrompts.js");
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
   * Test cache key generation for different style combinations
   * @param {string} prompt - Test prompt
   * @returns {Object} Cache key test results
   */
  async testCacheKeys(prompt = "test character") {
    const testCombinations = [
      { colorStyle: "neon", mood: "mysterious", artStyle: "modern" },
      { colorStyle: "monochrome", mood: "mysterious", artStyle: "modern" },
      { colorStyle: "neon", mood: "happy", artStyle: "modern" },
      { colorStyle: "neon", mood: "mysterious", artStyle: "studio" },
      { colorStyle: "pastel", mood: "cute", artStyle: "chibi" },
    ];

    const results = [];

    for (const styleOptions of testCombinations) {
      const enhancedPrompt = await this.buildAnimePrompt(
        prompt,
        styleOptions,
        this.aiService.getPrimaryProvider(),
      );

      let styleHash = "default";
      if (styleOptions) {
        const styleString = JSON.stringify(
          styleOptions,
          Object.keys(styleOptions).sort(),
        );
        let hash = 0;
        for (let i = 0; i < styleString.length; i++) {
          const char = styleString.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        styleHash = Math.abs(hash).toString(36);
      }
      const cacheKey = `avatar_${this.aiService.getPrimaryProvider()}_${styleHash}_${Buffer.from(enhancedPrompt).toString("base64").slice(0, 32)}`;

      results.push({
        styleOptions,
        styleHash,
        cacheKey,
        promptLength: enhancedPrompt.length,
      });
    }

    return results;
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
    coreUserData = null,
  ) {
    const requestId = `avatar_${userId}_${Date.now()}`;
    const startTime = Date.now();

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Step 1: Initialize
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_INITIALIZING);

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
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_BUILDING_PROMPT);

          // Determine provider for prompt optimization (use avatar feature provider)
          const targetProvider =
            this.aiService.providerManager?.getProviderForFeature("avatar") ||
            "stability";
          const enhancedPrompt = await this.buildAnimePrompt(
            prompt,
            styleOptions,
            targetProvider,
          );

          // ============================================================================
          // LOG FULL PROMPT BEING SENT TO AI
          // ============================================================================
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          logger.info(
            `[AVATAR PROMPT LOG] User: ${userId} | Request ID: ${requestId}`,
          );
          logger.info(`[AVATAR PROMPT LOG] Original Prompt: "${prompt}"`);
          logger.info(
            `[AVATAR PROMPT LOG] Style Options: ${JSON.stringify(styleOptions)}`,
          );
          logger.info(`[AVATAR PROMPT LOG] Provider: ${targetProvider}`);
          logger.info(
            `[AVATAR PROMPT LOG] Enhanced Prompt (${enhancedPrompt.length} chars):`,
          );
          logger.info(`[AVATAR PROMPT LOG] "${enhancedPrompt}"`);
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          if (showDebugPrompt) {
            return {
              enhancedPrompt,
              originalPrompt: prompt,
            };
          }

          // Step 3: Connect to AI provider
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_CONNECTING);

          // Step 4: Generate image
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_GENERATING);

          // Avatar generation uses feature-based provider selection
          const avatarProvider =
            this.aiService.providerManager?.getProviderForFeature("avatar");
          if (!avatarProvider) {
            throw new Error(
              "Avatar generation is currently unavailable. No avatar generation service is configured.",
            );
          }

          const result = await this.aiService.generate({
            type: "image",
            prompt: enhancedPrompt,
            provider: avatarProvider, // Use feature-based provider selection
            progressCallback, // Pass progress callback for real-time updates
            config: {
              aspectRatio: "1:1", // Square avatars (1024x1024 optimal for AnythingXL)
              safetyTolerance: 6, // Most permissive safety tolerance
              useAvatarPrompts: true, // Use avatar-specific prompts
              userId, // Pass userId for rate limiting
              styleOptions, // Include style options for cache key differentiation
              featureName: "avatar", // Pass feature name for model selection
            },
          });

          // Step 5: Process image data
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_PROCESSING);

          const processingTime = Date.now() - startTime;
          logger.info(
            `Avatar generation completed in ${processingTime}ms for user ${userId}`,
          );

          // Step 6: Finalize result
          if (progressCallback)
            progressCallback(AI_STATUS_MESSAGES.AVATAR_FINALIZING);

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
            throw new Error(
              "The image generation service authentication failed. This feature is temporarily unavailable.",
            );
          } else if (error.message.includes("API error: 429")) {
            throw new Error(
              "The image generation service is busy right now. Please try again in a few moments.",
            );
          } else if (error.message.includes("API error: 402")) {
            throw new Error(
              "The image generation service has insufficient credits. This feature is temporarily unavailable.",
            );
          } else if (error.message.includes("No image generated")) {
            throw new Error(
              "The image could not be generated. Please try a different prompt.",
            );
          } else if (
            error.message.includes("not properly configured") ||
            error.message.includes("currently unavailable") ||
            error.message.includes("temporarily unavailable")
          ) {
            // Already user-friendly, pass through
            throw error;
          } else {
            throw new Error(`Avatar generation failed: ${error.message}`);
          }
        }
      },
      { prompt, showDebugPrompt, userId, coreUserData },
    );
  }

  /**
   * Build enhanced anime prompt with fixed template
   * @param {string} userPrompt - User's original prompt
   * @param {Object} styleOptions - Optional style overrides
   * @returns {Promise<string>} Enhanced prompt
   */
  async buildAnimePrompt(userPrompt, styleOptions = {}, provider = "comfyui") {
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
        `Provider ${provider} not found in PROVIDER_PROMPTS, falling back to comfyui`,
      );
    }
    const finalConfig =
      providerConfig ||
      config.PROVIDER_PROMPTS.comfyui ||
      config.PROVIDER_PROMPTS.stability;

    // Build prompt based on provider type
    let prompt;
    if (provider === "openrouter") {
      // OpenRouter uses conversational format
      prompt = finalConfig.base.replace(
        "{characterDescription}",
        baseDescription,
      );

      // Add art style first for maximum impact
      if (enhancements.artStyle) {
        // Special emphasis for chibi style
        if (enhancements.artStyle.toLowerCase().includes("chibi")) {
          prompt = `${enhancements.artStyle}, CHIBI CHARACTER, ${prompt}`;
        } else {
          prompt = `${enhancements.artStyle}, ${prompt}`;
        }
      }

      // Add other enhancements as additional instructions
      const enhancementParts = [
        enhancements.characterType,
        enhancements.colorStyle,
        enhancements.moodStyle,
      ]
        .filter(Boolean)
        .filter(part => part.trim() !== "")
        .map(part => part.trim());

      if (enhancementParts.length > 0) {
        // Add color and mood styles with emphasis
        const enhancedParts = enhancementParts.map(part => {
          if (
            part.toLowerCase().includes("vibrant") ||
            part.toLowerCase().includes("neon")
          ) {
            return `${part}, BOLD COLORS`;
          } else if (part.toLowerCase().includes("pastel")) {
            return `${part}, SOFT COLORS`;
          } else if (part.toLowerCase().includes("monochrome")) {
            return `${part}, GRAYSCALE`;
          } else if (
            part.toLowerCase().includes("happy") ||
            part.toLowerCase().includes("cute")
          ) {
            return `${part}, POSITIVE VIBES`;
          } else if (
            part.toLowerCase().includes("serious") ||
            part.toLowerCase().includes("mysterious")
          ) {
            return `${part}, INTENSE MOOD`;
          }
          return part;
        });

        prompt += ` ${enhancedParts.join(" ")}`;
      }

      prompt += ` ${finalConfig.suffix}`;
    } else if (provider === "openai") {
      // OpenAI uses descriptive format
      prompt = finalConfig.base.replace(
        "{characterDescription}",
        baseDescription,
      );

      // Add art style first for maximum impact
      if (enhancements.artStyle) {
        // Special emphasis for chibi style
        if (enhancements.artStyle.toLowerCase().includes("chibi")) {
          prompt = `${enhancements.artStyle}, CHIBI CHARACTER, ${prompt}`;
        } else {
          prompt = `${enhancements.artStyle}, ${prompt}`;
        }
      }

      // Add other enhancements as additional descriptions
      const enhancementParts = [
        enhancements.characterType,
        enhancements.colorStyle,
        enhancements.moodStyle,
      ]
        .filter(Boolean)
        .filter(part => part.trim() !== "")
        .map(part => part.trim());

      if (enhancementParts.length > 0) {
        // Add color and mood styles with emphasis
        const enhancedParts = enhancementParts.map(part => {
          if (
            part.toLowerCase().includes("vibrant") ||
            part.toLowerCase().includes("neon")
          ) {
            return `${part}, BOLD COLORS`;
          } else if (part.toLowerCase().includes("pastel")) {
            return `${part}, SOFT COLORS`;
          } else if (part.toLowerCase().includes("monochrome")) {
            return `${part}, GRAYSCALE`;
          } else if (
            part.toLowerCase().includes("happy") ||
            part.toLowerCase().includes("cute")
          ) {
            return `${part}, POSITIVE VIBES`;
          } else if (
            part.toLowerCase().includes("serious") ||
            part.toLowerCase().includes("mysterious")
          ) {
            return `${part}, INTENSE MOOD`;
          }
          return part;
        });

        prompt += ` ${enhancedParts.join(" ")}`;
      }

      prompt += ` ${finalConfig.suffix}`;
    } else {
      // ComfyUI/Stability AI uses comma-separated format - art style goes first
      const artStylePart = enhancements.artStyle
        ? enhancements.artStyle.toLowerCase().includes("chibi")
          ? `${enhancements.artStyle}, CHIBI CHARACTER`
          : enhancements.artStyle
        : null;

      // Enhance color and mood styles for ComfyUI/Stability AI
      const enhancedColorStyle = enhancements.colorStyle
        ? enhancements.colorStyle.toLowerCase().includes("vibrant") ||
          enhancements.colorStyle.toLowerCase().includes("neon")
          ? `${enhancements.colorStyle}, BOLD COLORS`
          : enhancements.colorStyle.toLowerCase().includes("pastel")
            ? `${enhancements.colorStyle}, SOFT COLORS`
            : enhancements.colorStyle.toLowerCase().includes("monochrome")
              ? `${enhancements.colorStyle}, GRAYSCALE`
              : enhancements.colorStyle
        : null;

      const enhancedMoodStyle = enhancements.moodStyle
        ? enhancements.moodStyle.toLowerCase().includes("happy") ||
          enhancements.moodStyle.toLowerCase().includes("cute")
          ? `${enhancements.moodStyle}, POSITIVE VIBES`
          : enhancements.moodStyle.toLowerCase().includes("serious") ||
              enhancements.moodStyle.toLowerCase().includes("mysterious")
            ? `${enhancements.moodStyle}, INTENSE MOOD`
            : enhancements.moodStyle
        : null;

      const parts = [
        artStylePart, // Art style first for maximum impact
        finalConfig.base.replace("{characterDescription}", baseDescription),
        enhancements.characterType,
        enhancedColorStyle,
        enhancedMoodStyle,
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
  coreUserData,
) =>
  avatarService.generateAvatar(
    prompt,
    showDebugPrompt,
    userId,
    styleOptions,
    progressCallback,
    coreUserData,
  );
export const buildAnimePrompt = (userPrompt, styleOptions) =>
  avatarService.buildAnimePrompt(userPrompt, styleOptions);
