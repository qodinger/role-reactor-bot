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
      // AI Chat Feature (/chat command) - DISABLED
      aiChat: {
        enabled: false, // Disabled - AI chat removed
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
      },

      // Avatar Generation (/avatar command)
      avatar: {
        enabled: true,
        provider: "stability", // ONLY use Stability AI
        model: "sd3.5-flash", // Use fast, cost-efficient model (Draft/Fastest)
        // NO FALLBACKS - use only what is configured
        allowNSFWProviders: false, // Strict safety - no NSFW providers allowed
      },

      // Safe Image Generation (/imagine command - non-NSFW)
      imagineGeneral: {
        enabled: true,
        provider: "stability", // ONLY use Stability AI for safe content
        model: "sd3.5-flash", // Default model
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
            "sd3.5-flash": {
              name: "SD 3.5 Flash",
              speed: "fastest",
              quality: "good",
              parameters: 1000000000, // 1 billion parameters, highly optimized
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

      civitai: {
        enabled: process.env.CIVITAI_ENABLED === "true",
        name: "Civitai",
        baseUrl: "https://orchestration.civitai.com",
        apiKey: process.env.CIVITAI_API_KEY || null,
        capabilities: ["image"],
        safetyLevel: "nsfw", // NSFW allowed

        // Anime-optimized models available on Civitai
        models: {
          image: {
            "aisha-ai-official/animagine-xl-4.0": {
              name: "Animagine XL 4.0",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "excellent",
              speed: "medium",
              flags: ["anime", "manga", "2d", "stylized", "nsfw", "character"],
              description: "Ultimate anime-themed SDXL model",
              costUSD: 0.0068, // ~$0.0068 per generation
            },
            "aisha-ai-official/wai-nsfw-illustrious-v11": {
              name: "NSFW Illustrious V1.1",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "excellent",
              speed: "medium",
              flags: ["anime", "nsfw", "explicit"],
              description: "Illustrious-based NSFW anime model",
              costUSD: 0.0061, // ~$0.0061 per generation
            },
            "cjwbw/anything-v4.0": {
              name: "Anything V4.0",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "high",
              speed: "fast",
              flags: ["anime", "manga", "2d", "nsfw"],
              description: "Classic high-quality anime model",
              costUSD: 0.005, // Estimated ~$0.005 per generation
            },
            "datacte/proteus-v0.3": {
              name: "Proteus V0.3",
              type: "anime",
              style: "anime",
              nsfw: true,
              quality: "high",
              speed: "medium",
              flags: ["anime", "artistic", "nsfw"],
              description: "Versatile model good for anime and artistic styles",
              costUSD: 0.024, // ~$0.024 per generation
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
  // Base conversion rate: 1 USD = X Core Credits (must match storefront price)
  const BASE_CONVERSION_RATE = 15; // 1 USD = 15 Core Credits (Matches Storefront)

  // Platform markup applied on top of the raw conversion rate.
  // This is the PROFIT MARGIN knob — raise it to increase margin.
  //   1.25 → 20% gross margin  (user pays 25% more Core than raw API cost implies)
  //   1.50 → 33% gross margin
  //   2.00 → 50% gross margin
  // The effective charge rate = BASE_CONVERSION_RATE × PLATFORM_MARKUP
  // At 1.25: effective rate = 15 × 1.25 = 18.75 Core per $1 of API cost
  const PLATFORM_MARKUP = 1.25;

  // Minimum charge per request (in Core credits)
  // Prevents micro-transactions for very small API calls
  const BASE_MINIMUM_CHARGE = 0.05; // 0.05 Core minimum

  // Formula: Core_Credits = max(API_Cost_USD × BASE_CONVERSION_RATE × PLATFORM_MARKUP, BASE_MINIMUM_CHARGE)

  return {
    // Text generation credits are calculated dynamically based on actual token usage (OpenRouter)
    // or use fixed credits per request (other providers). These values are fallback minimums only.
    aiChat: BASE_MINIMUM_CHARGE, // Use standardized minimum charge

    // Image generation credits per image - provider and model specific
    aiImage: 5.0, // Default image generation cost (3 images per $1)

    // Provider-specific costs in Core credits
    // These are based on actual API costs from providers
    providerCosts: {
      stability: {
        // Stability AI model costs
        "sd3.5-large": 8.0,
        "sd3.5-large-turbo": 5.0,
        "sd3.5-medium": 4.0,
        "sd3.5-flash": 5.0,
      },
      comfyui: {
        // ComfyUI/self-hosted compute costs
        default: 0.08,
      },
      runpod: {
        // RunPod serverless compute costs
        default: 0.79,
      },
      civitai: {
        // Civitai API - pay per use with Buzz
        // ~$0.006 per image for anime models
        default: 0.01, // Conservative estimate
        "aisha-ai-official/animagine-xl-4.0": 0.0068,
        "aisha-ai-official/wai-nsfw-illustrious-v11": 0.0061,
        "cjwbw/anything-v4.0": 0.005,
        "datacte/proteus-v0.3": 0.024,
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
        conversionRate: BASE_CONVERSION_RATE,
        platformMarkup: PLATFORM_MARKUP,
        minimumCharge: BASE_MINIMUM_CHARGE,
      },
      anthropic: {
        conversionRate: BASE_CONVERSION_RATE,
        platformMarkup: PLATFORM_MARKUP,
        minimumCharge: BASE_MINIMUM_CHARGE,
      },
      openai: {
        conversionRate: BASE_CONVERSION_RATE,
        platformMarkup: PLATFORM_MARKUP,
        minimumCharge: BASE_MINIMUM_CHARGE,
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
    enabled: true, // Set to true to enable content filtering, false to disable
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
  const { conversionRate, platformMarkup, minimumCharge } =
    getAIFeatureCosts().tokenPricing.openrouter;
  // Always apply the markup so every call is profitable, not just break-even
  const calculatedCredits = usdCost * conversionRate * platformMarkup;
  return Math.max(calculatedCredits, minimumCharge);
}

/**
 * Helper function to get current conversion rate
 * @returns {Object} Conversion rate information
 */
export function getConversionRateInfo() {
  const { conversionRate, platformMarkup, minimumCharge } =
    getAIFeatureCosts().tokenPricing.openrouter;
  const effectiveRate = conversionRate * platformMarkup;

  return {
    conversionRate,
    platformMarkup,
    effectiveRate,
    minimumCharge,
    coreValueUSD: 1 / conversionRate,
    coreValueCents: (1 / conversionRate) * 100,
    formula: `Core_Credits = max(API_Cost_USD × ${conversionRate} × ${platformMarkup}, ${minimumCharge})`,
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
