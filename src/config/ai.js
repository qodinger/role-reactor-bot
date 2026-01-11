/**
 * AI Configuration
 * Provider configurations, feature costs, and AI-related settings
 */

/**
 * AI Configuration - Feature-Based Design with Content Safety Enforcement
 *
 * SAFETY PHILOSOPHY:
 * - Safe content requests NEVER use NSFW-capable providers, even as fallbacks
 * - Users requesting safe content are protected from accidentally receiving NSFW content
 * - Clear error messages when no safe providers are available
 * - NSFW content is only generated when explicitly requested with --nsfw flag
 *
 * PROVIDER SAFETY LEVELS:
 * - "safe": Only generates safe content (Stability AI, OpenAI, OpenRouter)
 * - "mixed": Can generate both safe and NSFW content (ComfyUI, RunPod)
 * - Providers with "mixed" safety are NEVER used for safe content requests
 *
 * Easy control over which provider/model each feature uses
 */

/**
 * Get AI feature configuration
 * @returns {Object} Feature-based AI configuration
 */
export function getAIModels() {
  return {
    // =============================================================================
    // FEATURE CONFIGURATIONS
    // =============================================================================
    // Each feature can be independently enabled/disabled and configured

    features: {
      // AI Chat Feature (/chat command)
      aiChat: {
        enabled: true,
        provider: "openrouter", // ONLY use OpenRouter
        model: "openai/gpt-4o-mini", // ONLY use this model
        // NO FALLBACKS - use only what is configured
      },

      // Avatar Generation (/avatar command)
      avatar: {
        enabled: true,
        provider: "stability", // ONLY use Stability AI
        model: "sd3.5-flash", // ONLY use this model
        // NO FALLBACKS - use only what is configured
        allowNSFWProviders: false, // Strict safety - no NSFW providers allowed
      },

      // Safe Image Generation (/imagine command - non-NSFW)
      imagineGeneral: {
        enabled: true,
        provider: "stability", // ONLY use Stability AI for safe content
        model: "sd3.5-large-turbo", // Default model
        allowNSFWProviders: false, // Strict safety - no NSFW providers allowed
      },

      // NSFW Image Generation (/imagine command with --nsfw flag)
      imagineNSFW: {
        enabled: true,
        provider: "auto", // Auto-select: RunPod if available, otherwise ComfyUI
        model: "animagine-xl-4.0-opt.safetensors", // Default model for ComfyUI
        allowNSFWProviders: true, // Allow NSFW providers for NSFW content
      },
    },

    // =============================================================================
    // PROVIDER CONFIGURATIONS
    // =============================================================================
    // Provider settings and available models

    providers: {
      stability: {
        enabled: true,
        name: "Stability AI",
        baseUrl: "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        apiKey: process.env.STABILITY_API_KEY,
        capabilities: ["image"], // What this provider can do
        safetyLevel: "safe", // SAFE ONLY - no NSFW content allowed
        models: {
          image: {
            "sd3.5-flash": {
              name: "SD 3.5 Flash",
              speed: "fastest",
              quality: "good",
            },
            "sd3.5-medium": {
              name: "SD 3.5 Medium",
              speed: "medium",
              quality: "better",
            },
            "sd3.5-large": {
              name: "SD 3.5 Large",
              speed: "slow",
              quality: "best",
            },
            "sd3.5-large-turbo": {
              name: "SD 3.5 Large Turbo",
              speed: "fast",
              quality: "best",
            },
          },
        },
      },

      openrouter: {
        enabled: true,
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        capabilities: ["text", "image"], // Supports both text and image
        safetyLevel: "safe", // SAFE ONLY - filtered content
        models: {
          text: {
            "openai/gpt-4o-mini": {
              name: "GPT-4o Mini",
              speed: "fastest",
              cost: "lowest",
            },
            "deepseek/deepseek-chat": {
              name: "DeepSeek Chat",
              speed: "fast",
              cost: "low",
            },
            "anthropic/claude-3.5-sonnet": {
              name: "Claude 3.5 Sonnet",
              speed: "medium",
              cost: "medium",
            },
          },
          image: {
            "black-forest-labs/flux.2-flex": {
              name: "FLUX 2 Flex",
              speed: "fast",
              quality: "excellent",
            },
            "black-forest-labs/flux.2-pro": {
              name: "FLUX 2 Pro",
              speed: "medium",
              quality: "best",
            },
          },
        },
      },

      openai: {
        enabled: false, // Disabled by default (enable if you have API key)
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        capabilities: ["text", "image"],
        safetyLevel: "safe", // SAFE ONLY - strict content filtering
        models: {
          text: {
            "gpt-4o": { name: "GPT-4o", speed: "medium", cost: "high" },
            "gpt-4o-mini": {
              name: "GPT-4o Mini",
              speed: "fast",
              cost: "medium",
            },
            "gpt-3.5-turbo": {
              name: "GPT-3.5 Turbo",
              speed: "fastest",
              cost: "low",
            },
          },
          image: {
            "dall-e-3": {
              name: "DALL-E 3",
              speed: "medium",
              quality: "excellent",
            },
          },
        },
      },

      comfyui: {
        enabled: true, // Enable ComfyUI for NSFW content generation
        name: "ComfyUI (Self-Hosted)",
        baseUrl: process.env.COMFYUI_API_URL || "http://127.0.0.1:8188",
        apiKey: process.env.COMFYUI_API_KEY || null, // Optional for self-hosted
        workflowId: process.env.COMFYUI_WORKFLOW_ID || null,
        nsfwWorkflow:
          process.env.COMFYUI_NSFW_WORKFLOW || "animagine", // Default to animagine workflow
        capabilities: ["image"], // Image generation only
        safetyLevel: "nsfw", // NSFW ONLY - no safe content generation

        // Model configurations with flags for easy selection
        models: {
          image: {
            // Anime/Manga Style Models
            "animagine-xl-4.0-opt.safetensors": {
              name: "Animagine XL 4.0",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "excellent",
              speed: "medium",
              flags: ["anime", "manga", "2d", "stylized", "nsfw", "character"],
              description: "High-quality anime model with superior character knowledge",
            },

            "AnythingXL_xl.safetensors": {
              name: "Anything XL",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "high",
              speed: "medium",
              flags: ["anime", "manga", "2d", "stylized", "nsfw"],
              description: "High-quality anime/manga style model",
            },

            // Realistic Models
            "realismEngineSDXL_v30VAE.safetensors": {
              name: "Realism Engine SDXL",
              type: "realistic",
              style: "photorealistic",
              nsfw: true,
              quality: "high",
              speed: "slow",
              flags: ["realistic", "photorealistic", "3d", "nsfw"],
              description: "Photorealistic image generation",
            },

            // Furry/Anthropomorphic Models
            "ponyDiffusionV6XL_v6StartWithThisOne.safetensors": {
              name: "Pony Diffusion V6 XL",
              type: "furry",
              style: "anthropomorphic",
              nsfw: true,
              quality: "high",
              speed: "medium",
              flags: ["furry", "anthropomorphic", "pony", "nsfw"],
              description: "Anthropomorphic and furry art generation",
            },

            // Artistic Models
            "deliberate_v2.safetensors": {
              name: "Deliberate V2",
              type: "artistic",
              style: "artistic",
              nsfw: true,
              quality: "high",
              speed: "fast",
              flags: ["artistic", "creative", "versatile", "nsfw"],
              description: "Versatile artistic style model",
            },
          },
        },

        // Available workflows (metadata only - actual workflows loaded from JSON files)
        workflows: {
          "animagine-fast": {
            name: "Animagine Fast Workflow",
            description: "Fast anime generation optimized for speed (20 steps)",
            settings: { steps: 20, cfg: 5.0, sampler: "dpmpp_2m" },
          },
          "anything-fast": {
            name: "Anything Fast Workflow",
            description: "Fast versatile anime generation (15 steps)",
            settings: { steps: 15, cfg: 6.0, sampler: "dpmpp_2m" },
          },
          "animagine-quality": {
            name: "Animagine HQ Workflow",
            description: "High-quality anime generation with enhanced details and refinement pass",
            settings: { steps: 35, cfg: 6.0, sampler: "dpmpp_2m_sde" },
          },
          "anything-quality": {
            name: "Anything HQ Workflow", 
            description: "High-quality versatile anime generation with detail enhancement",
            settings: { steps: 30, cfg: 7.5, sampler: "dpmpp_2m_sde" },
          },
          "animagine": {
            name: "Animagine Standard Workflow",
            description: "Standard quality Animagine XL 4.0 generation",
            settings: { steps: 28, cfg: 5.0, sampler: "dpmpp_2m" },
          },
          "anything": {
            name: "Anything Standard Workflow", 
            description: "Standard quality Anything XL generation",
            settings: { steps: 20, cfg: 7.0, sampler: "dpmpp_2m" },
          },
        },
      },

      runpod: {
        enabled: process.env.RUNPOD_ENABLED === "true", // Enable via environment variable
        name: "RunPod Serverless",
        apiKey: process.env.RUNPOD_API_KEY || null,
        endpointId: process.env.RUNPOD_ENDPOINT_ID || null,
        capabilities: ["image"],
        safetyLevel: "nsfw", // NSFW ONLY - no safe content generation
        isRunPod: true, // Flag to indicate this is a RunPod deployment

        // RunPod configuration
        runPod: {
          apiKey: process.env.RUNPOD_API_KEY,
          endpointId: process.env.RUNPOD_ENDPOINT_ID,
          timeout: 300000, // 5 minutes
          maxRetries: 3,
        },

        // Same model configurations as ComfyUI (since RunPod runs ComfyUI)
        models: {
          image: {
            // Use same model configs as ComfyUI
            "AnythingXL_xl.safetensors": {
              name: "Anything XL",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "high",
              speed: "medium",
              flags: ["anime", "manga", "2d", "stylized", "nsfw"],
              description: "High-quality anime/manga style model",
            },

            "realismEngineSDXL_v30VAE.safetensors": {
              name: "Realism Engine SDXL",
              type: "realistic",
              style: "photorealistic",
              nsfw: true,
              quality: "high",
              speed: "slow",
              flags: ["realistic", "photorealistic", "3d", "nsfw"],
              description: "Photorealistic image generation",
            },
          },
        },

        // Available workflows (same as ComfyUI)
        workflows: {
          "animagine-quality": {
            name: "Animagine HQ Workflow",
            description: "High-quality anime generation with enhanced details and refinement pass",
            settings: { steps: 35, cfg: 6.0, sampler: "dpmpp_2m_sde" },
          },
          "anything-quality": {
            name: "Anything HQ Workflow",
            description: "High-quality versatile anime generation with detail enhancement", 
            settings: { steps: 30, cfg: 7.5, sampler: "dpmpp_2m_sde" },
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
