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
      stability: {
        enabled: false,
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
        enabled: false,
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        models: {
          image: {
            primary: "google/gemini-3-pro-image-preview",
          },
          text: {
            // Recommended models (uncomment to switch):
            // primary: "deepseek/deepseek-chat", // Current: Fast, matches GPT-4o performance
            primary: "openai/gpt-4o-mini", // Fastest + cheapest option
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
      comfyui: {
        enabled: true, // Direct ComfyUI connection
        name: "ComfyUI",
        baseUrl: process.env.COMFYUI_API_URL || "http://127.0.0.1:8188",
        apiKey: process.env.COMFYUI_API_KEY || null, // Optional for direct connection
        workflowId: process.env.COMFYUI_WORKFLOW_ID || null, // Not needed for direct ComfyUI
        models: {
          image: {
            primary: "default",
            checkpoint:
              process.env.COMFYUI_CHECKPOINT || "AnythingXL_xl.safetensors", // Checkpoint model name
          },
        },
      },
      runpod: {
        enabled: false, // RunPod Serverless (set to true to use)
        name: "RunPod Serverless",
        apiKey: process.env.RUNPOD_API_KEY || null,
        endpointId: process.env.RUNPOD_ENDPOINT_ID || null,
        models: {
          image: {
            primary: "default",
            checkpoint:
              process.env.RUNPOD_CHECKPOINT || "AnythingXL_xl.safetensors",
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
    aiChat: 0.02,
    aiImage: 1,
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
