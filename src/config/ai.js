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
 * - "safe": Only generates safe content (Stability AI, OpenRouter)
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
        model: "sd3.5-large-turbo", // Use fast, high-quality model
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
        model: "AnythingXL_xl.safetensors", // Default model for ComfyUI
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
            "sd3.5-large": {
              name: "SD 3.5 Large",
              speed: "slow",
              quality: "best",
              parameters: 8000000000, // 8 billion parameters
            },
            "sd3.5-large-turbo": {
              name: "SD 3.5 Large Turbo",
              speed: "fast",
              quality: "excellent",
              parameters: 8000000000, // 8 billion parameters, optimized for speed
            },
            "sd3.5-medium": {
              name: "SD 3.5 Medium",
              speed: "medium",
              quality: "good",
              parameters: 2500000000, // 2.5 billion parameters
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

      comfyui: {
        enabled: true, // Enable ComfyUI for NSFW content generation
        name: "ComfyUI (Self-Hosted)",
        baseUrl: process.env.COMFYUI_API_URL || "http://127.0.0.1:8188",
        apiKey: process.env.COMFYUI_API_KEY || null, // Optional for self-hosted
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
              description:
                "High-quality anime model with superior character knowledge",
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
      },
    },
  };
}

/**
 * Get AI feature costs
 * @returns {Object} Feature costs configuration
 */
export function getAIFeatureCosts() {
  // =============================================================================
  // CENTRALIZED CONVERSION RATE CONFIGURATION
  // =============================================================================
  //
  // IMPORTANT: These are the ONLY values you need to change to adjust pricing
  //
  // Base conversion rate: 1 USD = X Core Credits
  // Higher rate = cheaper Cores for users, lower revenue per API call
  // Lower rate = more expensive Cores for users, higher revenue per API call
  const BASE_CONVERSION_RATE = 50; // 1 USD = 50 Core Credits (1 Core = 2.0 cents)

  // Minimum charge per request (in Core credits)
  // Prevents micro-transactions for very small API calls
  const BASE_MINIMUM_CHARGE = 0.05; // 0.05 Core minimum (~300 messages per $1)

  // Formula: Core_Credits = max(API_Cost_USD × BASE_CONVERSION_RATE, BASE_MINIMUM_CHARGE)

  return {
    // Text generation credits are calculated dynamically based on actual token usage (OpenRouter)
    // or use fixed credits per request (other providers). These values are fallback minimums only.
    aiChat: BASE_MINIMUM_CHARGE, // Use standardized minimum charge

    // Image generation credits per image - provider and model specific
    aiImage: 1.2, // Default image generation cost

    // Provider-specific costs in Core credits
    // These are based on actual API costs from providers
    providerCosts: {
      stability: {
        // Stability AI model costs
        "sd3.5-large": 3.41,
        "sd3.5-large-turbo": 2.1,
        "sd3.5-medium": 1.84,
        "sd3.5-flash": 1.05,
      },
      comfyui: {
        // ComfyUI/self-hosted compute costs
        default: 0.08,
      },
      runpod: {
        // RunPod serverless compute costs
        default: 0.79,
      },
      openrouter: {
        // OpenRouter uses dynamic pricing based on actual token usage
        // These are fallback costs if usage data is unavailable
        "openai/gpt-4o-mini": 0.08,
        "anthropic/claude-3.5-sonnet": 0.35,
        "deepseek/deepseek-chat": 0.08,
        "black-forest-labs/flux.2-flex": 1.05,
        "black-forest-labs/flux.2-pro": 2.1,
      },
    },

    // Token-based pricing for text generation (when usage data is available)
    // Conversion rates from provider credits to Core credits
    // All providers use the same BASE_CONVERSION_RATE for consistency
    tokenPricing: {
      openrouter: {
        // OpenRouter returns actual costs in their credits, convert to Core
        conversionRate: BASE_CONVERSION_RATE, // Uses base rate
        minimumCharge: BASE_MINIMUM_CHARGE, // Uses base minimum
      },
      // Add other providers as needed
      anthropic: {
        conversionRate: BASE_CONVERSION_RATE, // Uses base rate
        minimumCharge: BASE_MINIMUM_CHARGE, // Uses base minimum
      },
      openai: {
        conversionRate: BASE_CONVERSION_RATE, // Uses base rate
        minimumCharge: BASE_MINIMUM_CHARGE, // Uses base minimum
      },
    },

    // Bulk discount system for large purchases
    bulkDiscounts: {
      enabled: true,
      tiers: [
        { threshold: 1000, discount: 0.03 }, // 3% off for 1000+ Cores
        { threshold: 2500, discount: 0.05 }, // 5% off for 2500+ Cores
        { threshold: 5000, discount: 0.08 }, // 8% off for 5000+ Cores
      ],
    },

    // Loyalty rewards system
    loyaltyRewards: {
      enabled: true,
      pointsPerDollar: 1, // 1 loyalty point per $1 spent
      rewardTiers: [
        { points: 100, reward: "3% bonus on next purchase" },
        { points: 250, reward: "5% bonus on next purchase" },
        { points: 500, reward: "8% bonus + priority support" },
      ],
    },
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

/**
 * Helper function to calculate Core credits from USD cost
 * Uses the centralized conversion rate for consistency
 * @param {number} usdCost - Cost in USD
 * @returns {number} Core credits needed
 */
export function calculateCoreCredits(usdCost) {
  const featureCosts = getAIFeatureCosts();
  const conversionRate = featureCosts.tokenPricing.openrouter.conversionRate;
  const minimumCharge = featureCosts.tokenPricing.openrouter.minimumCharge;

  const calculatedCredits = usdCost * conversionRate;
  return Math.max(calculatedCredits, minimumCharge);
}

/**
 * Helper function to get current conversion rate
 * @returns {Object} Conversion rate information
 */
export function getConversionRateInfo() {
  const featureCosts = getAIFeatureCosts();
  const rate = featureCosts.tokenPricing.openrouter.conversionRate;
  const minimum = featureCosts.tokenPricing.openrouter.minimumCharge;

  return {
    conversionRate: rate,
    minimumCharge: minimum,
    coreValueUSD: 1 / rate,
    coreValueCents: (1 / rate) * 100,
    formula: `Core_Credits = max(API_Cost_USD × ${rate}, ${minimum})`,
  };
}

// Default export for convenience
export default {
  getAIModels,
  getAIFeatureCosts,
  getAvatarContentFilter,
  getAIConfig,
  calculateCoreCredits,
  getConversionRateInfo,
};
