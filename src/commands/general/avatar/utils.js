import { getLogger } from "../../../utils/logger.js";

/**
 * Validate user prompt for inappropriate content
 * @param {string} prompt - User's prompt
 * @returns {Object} Validation result with isValid and reason
 */
/**
 * Get list of inappropriate keywords for content detection
 * @returns {Array<string>} Array of inappropriate keywords
 */
export function getInappropriateKeywords() {
  // Content filtering disabled - return empty array to allow all content
  return [];
}

/**
 * Get explicit keywords (subset of inappropriate keywords)
 * Used for spoiler detection - only explicit sexual/nude content
 * @returns {Array<string>} Array of explicit keywords
 */
export function getExplicitNSFWKeywords() {
  // Content filtering disabled - return empty array to allow all content
  return [];
}

/**
 * Validate user prompt for inappropriate content
 * @param {string} prompt - User's prompt
 * @returns {Promise<Object>} Validation result with isValid and reason
 */
export async function validatePrompt(prompt) {
  const logger = getLogger();

  // Validate input
  if (!prompt || typeof prompt !== "string") {
    logger.debug(
      `[validatePrompt] Invalid prompt type: ${typeof prompt}, value: ${prompt}`,
    );
    return {
      isValid: false,
      reason: "Please provide a description for the avatar you want to create.",
    };
  }

  // Check prompt length (max 500 characters as per command definition)
  if (prompt.length > 500) {
    logger.warn(
      `[validatePrompt] Prompt too long: ${prompt.length} characters (max 500)`,
    );
    return {
      isValid: false,
      reason: `Your prompt is too long (${prompt.length} characters). Please keep it under 500 characters.`,
    };
  }

  // Get content filter setting from config (with fallback)
  // Default to disabled if config is not available
  let contentFilterEnabled = false;
  let newConfigLoaded = false;
  try {
    // Try new AI config first
    const aiConfigModule = await import("../../../config/ai.js").catch(
      () => null,
    );
    if (aiConfigModule) {
      const getAvatarFilter =
        aiConfigModule.getAvatarContentFilter ||
        aiConfigModule.default?.getAvatarContentFilter;
      if (getAvatarFilter) {
        const avatarFilter =
          typeof getAvatarFilter === "function"
            ? getAvatarFilter()
            : getAvatarFilter;
        contentFilterEnabled = avatarFilter?.enabled ?? false;
        newConfigLoaded = true;
      }
    }

    // Fallback to old config location for backward compatibility
    // Only check if new config wasn't successfully loaded
    if (!newConfigLoaded) {
      const configModule = await import("../../../config/config.js").catch(
        () => null,
      );
      if (configModule) {
        const config = configModule.default || configModule;
        contentFilterEnabled =
          config?.corePricing?.avatarContentFilter?.enabled ?? false;
      }
    }
  } catch {
    // Config not available, use default (disabled)
    contentFilterEnabled = false;
  }

  // Get inappropriate keywords
  const inappropriateKeywords = getInappropriateKeywords();

  const trimmedPrompt = prompt.trim();
  const lowerPrompt = trimmedPrompt.toLowerCase();

  // Check for inappropriate keywords (only if filter is enabled)
  if (contentFilterEnabled) {
    for (const keyword of inappropriateKeywords) {
      if (lowerPrompt.includes(keyword)) {
        logger.warn(
          `[validatePrompt] Inappropriate content detected: "${trimmedPrompt.substring(0, 100)}..." (keyword: ${keyword})`,
        );
        return {
          isValid: false,
          reason: `Your prompt contains inappropriate content (detected: "${keyword}"). Please describe your character in a family-friendly way.`,
        };
      }
    }
  }

  // Additional validation checks DISABLED - content filtering removed
  const additionalChecks = [
    // All validation checks removed to allow all content
  ];

  // Pattern-based checks (only if filter is enabled)
  if (contentFilterEnabled) {
    for (const check of additionalChecks) {
      if (check.pattern.test(trimmedPrompt)) {
        logger.warn(
          `[validatePrompt] Pattern-based inappropriate content detected: "${trimmedPrompt.substring(0, 100)}..." (pattern: ${check.pattern})`,
        );
        return {
          isValid: false,
          reason: check.reason,
        };
      }
    }
  }

  // Minimal avatar validation - only block clearly non-avatar content
  const avatarValidationChecks = [
    // Only block multiple people (avatars should be single character)
    {
      pattern:
        /\b(group|multiple|several|many|two|three|four|five|six|seven|eight|nine|ten)\s+(people|characters|persons|individuals|boys|girls|men|women|friends|couple|couples)\b/i,
      reason:
        "Avatar generation creates single character images. Please describe one character only.",
    },
    // Block specific multiple people phrases
    {
      pattern:
        /\b(group of|couple|couples|pair of|duo|team of)\s+(friends|people|characters|persons|individuals|boys|girls|men|women|walking|standing|sitting)\b/i,
      reason:
        "Avatar generation creates single character images. Please describe one character only.",
    },
    // Only block pure abstract/non-character content (not when combined with character descriptions)
    {
      pattern:
        /^(abstract|artwork|painting|drawing|sketch|illustration|design|logo|symbol|icon|emblem|text|words|letters|numbers|symbols|signs|banners|posters|advertisements)$/i,
      reason:
        "Please describe a character for avatar generation, not just abstract art or symbols.",
    },
  ];

  for (const check of avatarValidationChecks) {
    if (check.pattern.test(trimmedPrompt)) {
      logger.warn(
        `Avatar-specific validation failed for prompt: "${trimmedPrompt}"`,
      );
      return {
        isValid: false,
        reason: check.reason,
      };
    }
  }

  // Check if prompt is too short (only for very short prompts)
  if (trimmedPrompt.length < 3) {
    return {
      isValid: false,
      reason:
        "Please provide a character description for avatar generation. Examples: 'anime girl', 'cool boy', 'mysterious character'.",
    };
  }

  // Very flexible character validation - only require basic character indication
  const basicCharacterIndicators = [
    "character",
    "person",
    "boy",
    "girl",
    "man",
    "woman",
    "avatar",
    "profile",
    "hair",
    "eyes",
    "face",
    "clothing",
    "outfit",
    "dress",
    "shirt",
    "jacket",
    "smile",
    "expression",
    "pose",
    "standing",
    "looking",
    "wearing",
    "anime",
    "manga",
    "art",
    "drawing",
    "illustration",
    "portrait",
    "background",
    "landscape",
    "forest",
    "city",
    "beach",
    "mountain",
    "room",
    "environment",
    "cool",
    "cute",
    "mysterious",
    "beautiful",
    "handsome",
    "pretty",
    "awesome",
    "amazing",
  ];

  const hasBasicCharacterIndicators = basicCharacterIndicators.some(keyword =>
    lowerPrompt.includes(keyword),
  );

  // Only require character indication if prompt is very short or clearly not character-related
  if (trimmedPrompt.length < 5 && !hasBasicCharacterIndicators) {
    return {
      isValid: false,
      reason:
        "Please provide a character description for avatar generation. Examples: 'anime girl', 'cool boy', 'mysterious character'.",
    };
  }

  // Only block if it's clearly not character-related AND very short
  if (!hasBasicCharacterIndicators && trimmedPrompt.length < 10) {
    return {
      isValid: false,
      reason:
        "Please describe a character for avatar generation. Examples: 'anime girl with pink hair', 'cool boy in a hoodie', 'mysterious character with glasses'.",
    };
  }

  return { isValid: true, prompt: trimmedPrompt };
}

/**
 * Format style options for logging
 * @param {Object} styleOptions - Style options object
 * @returns {string} Formatted string
 */
export function formatStyleOptions(styleOptions) {
  const options = [];
  if (styleOptions.colorStyle)
    options.push(`Color: ${styleOptions.colorStyle}`);
  if (styleOptions.mood) options.push(`Mood: ${styleOptions.mood}`);
  if (styleOptions.artStyle) options.push(`Art: ${styleOptions.artStyle}`);

  return options.length > 0 ? options.join(", ") : "None";
}

/**
 * Calculate generation cost (from centralized config)
 * @deprecated Use checkAIImageCredits() from aiCreditManager.js instead
 * @param {Object} _userData - User credit data (unused)
 * @returns {Promise<number>} Cost in credits
 */
export async function calculateGenerationCost(_userData) {
  // Import dynamically to avoid circular dependencies
  const { checkAIImageCredits } = await import(
    "../../../utils/ai/aiCreditManager.js"
  );
  const creditInfo = await checkAIImageCredits("dummy"); // Get config value
  return creditInfo.creditsNeeded;
}

/**
 * Format generation time for display
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {string} Formatted time string
 */
export function formatGenerationTime(startTime, endTime) {
  const duration = endTime - startTime;
  const seconds = Math.floor(duration / 1000);
  const milliseconds = duration % 1000;

  if (seconds > 0) {
    return `${seconds}.${Math.floor(milliseconds / 100)}s`;
  }
  return `${milliseconds}ms`;
}
