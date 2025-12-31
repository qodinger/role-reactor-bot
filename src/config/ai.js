/**
 * AI Configuration
 * Provider configurations, feature costs, and AI-related settings
 */

/**
 * Get AI model configuration
 * @returns {Object} AI model configuration object
 */
export function getAIModels() {
  return {
    // Model configurations
    // Providers are checked in order - first enabled provider is used
    // Set enabled: true to use, enabled: false to disable
    providers: {
      selfhosted: {
        enabled: false, // Disabled - using OpenRouter GPT-4o-mini instead
        name: "Self-Hosted",
        baseUrl: process.env.SELF_HOSTED_API_URL || "http://127.0.0.1:11434",
        apiKey: process.env.SELF_HOSTED_API_KEY || null,
        models: {
          image: {
            primary: "default",
          },
          text: {
            primary: process.env.SELF_HOSTED_TEXT_MODEL || "llama3.1:8b",
          },
        },
      },
      stability: {
        enabled: true,
        name: "Stability AI",
        baseUrl: "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        apiKey: process.env.STABILITY_API_KEY,
        models: {
          image: {
            primary: "sd3.5-flash", // Fastest and cheapest
            medium: "sd3.5-medium", // Balanced
            large: "sd3.5-large", // Highest quality
            turbo: "sd3.5-large-turbo", // Quality + Speed
          },
        },
      },
      openrouter: {
        enabled: true,
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        models: {
          image: {
            primary: "google/gemini-3-pro-image-preview",
          },
          text: {
            // Recommended models (uncomment to switch):
            // primary: "deepseek/deepseek-chat", // Current: Fast, matches GPT-4o performance, ~$0.14/$0.56 per million tokens
            primary: "openai/gpt-4o-mini", // Fastest + cheapest: $0.15/$0.60 per million tokens
          },
        },
      },
      openai: {
        enabled: false, // Set to true to enable this provider
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        models: {
          image: {
            primary: "dall-e-3",
          },
          text: {
            primary: "gpt-3.5-turbo",
          },
        },
      },
    },
  };
}

/**
 * Get AI feature costs
 * @returns {Object} Feature costs configuration
 */
export function getAIFeatureCosts() {
  return {
    aiChat: 0.05, // 0.05 Cores per chat request
    aiImage: 1, // 1 Core per image generation
  };
}

/**
 * Get avatar content filter settings
 * @returns {Object} Avatar content filter configuration
 */
export function getAvatarContentFilter() {
  return {
    enabled: false, // Set to true to enable content filtering, false to disable
  };
}

/**
 * Get all AI configuration
 * @returns {Object} Complete AI configuration object
 */
export function getAIConfig() {
  return {
    models: getAIModels(),
    featureCosts: getAIFeatureCosts(),
    avatarContentFilter: getAvatarContentFilter(),
  };
}

// Default export for convenience
export default {
  getAIModels,
  getAIFeatureCosts,
  getAvatarContentFilter,
  getAIConfig,
};
