import { getLogger } from "../logger.js";
import { performanceMonitor } from "./performanceMonitor.js";
import { ProviderManager } from "./providers/providerManager.js";
import { OpenRouterProvider } from "./providers/openRouterProvider.js";
import { StabilityProvider } from "./providers/stabilityProvider.js";
import { ComfyUIProvider } from "./providers/comfyUIProvider.js";
import { RunPodServerlessProvider } from "./providers/runpodServerlessProvider.js";
import { AI_STATUS_MESSAGES } from "./statusMessages.js";

const logger = getLogger();

// Config loading with fallback
let configCache = null;
let configLoadPromise = null;

async function loadConfig() {
  if (configCache) {
    return configCache;
  }

  if (configLoadPromise) {
    return configLoadPromise;
  }

  configLoadPromise = (async () => {
    try {
      // Try new AI config first
      const aiConfigModule = await import("../../config/ai.js").catch(
        () => null,
      );
      if (aiConfigModule) {
        const aiConfig =
          aiConfigModule.getAIModels || aiConfigModule.default?.getAIModels;
        if (aiConfig) {
          configCache = typeof aiConfig === "function" ? aiConfig() : aiConfig;
          return configCache;
        }
      }

      // Fallback to old config location for backward compatibility
      const configModule = await import("../../config/config.js").catch(
        () => null,
      );
      if (configModule) {
        configCache = (configModule.default || configModule)?.aiModels || {};
        return configCache;
      }
    } catch (error) {
      logger.debug("Failed to load config, using empty config:", error);
    }

    // Return empty config as fallback
    configCache = {
      providers: {
        openrouter: { enabled: false },
        stability: { enabled: false },
        comfyui: { enabled: false },
      },
      features: {
        aiChat: { enabled: false },
        avatar: { enabled: false },
        imagineGeneral: { enabled: false },
        imagineNSFW: { enabled: false },
      },
    };
    return configCache;
  })();

  return configLoadPromise;
}

/**
 * Multi-provider AI service supporting OpenRouter, Stability AI, and ComfyUI
 */
export class MultiProviderAIService {
  constructor() {
    // Initialize with empty config (will be loaded asynchronously)
    this.config = {
      providers: {
        openrouter: { enabled: false },
        stability: { enabled: false },
        comfyui: { enabled: false },
        runpod: { enabled: false },
      },
      features: {
        aiChat: { enabled: false },
        avatar: { enabled: false },
        imagineGeneral: { enabled: false },
        imagineNSFW: { enabled: false },
      },
    };
    this.providerManager = new ProviderManager(this.config);

    // Initialize provider instances with empty configs
    this.providers = {
      openrouter: new OpenRouterProvider(this.config.providers.openrouter),
      stability: new StabilityProvider(this.config.providers.stability),
      comfyui: new ComfyUIProvider(this.config.providers.comfyui || {}),
      runpod: new RunPodServerlessProvider(this.config.providers.runpod || {}),
    };

    // Load config asynchronously in background
    loadConfig()
      .then(loadedConfig => {
        this.config = loadedConfig;
        this.providerManager = new ProviderManager(this.config);
        this.providers = {
          openrouter: new OpenRouterProvider(
            this.config.providers?.openrouter || {},
          ),
          stability: new StabilityProvider(
            this.config.providers?.stability || {},
          ),
          runpod: new RunPodServerlessProvider(
            this.config.providers?.runpod || {},
          ),
          comfyui: new ComfyUIProvider(this.config.providers?.comfyui || {}),
        };
      })
      .catch(() => {
        // Ignore errors, already have fallback
      });
  }

  /**
   * Check if AI features are enabled (at least one provider is enabled)
   * @returns {boolean} True if AI is available
   */
  isEnabled() {
    return this.providerManager.isEnabled();
  }

  /**
   * Get the first enabled provider in priority order
   * @returns {string|null} Provider key or null if none enabled
   */
  getPrimaryProvider() {
    return this.providerManager.getPrimaryProvider();
  }

  /**
   * Get the appropriate provider for image generation
   * Smart routing based on content type for optimal results
   * @param {boolean} isNSFW - Whether content is NSFW for smart routing
   * @returns {string|null} Provider key or null if none enabled
   */
  getImageProvider(isNSFW = false) {
    return this.providerManager.getImageProvider(isNSFW);
  }

  /**
   * Get the appropriate provider for text/chat generation
   * Prefers self-hosted (Ollama) for local AI, then falls back to others
   * @returns {string|null} Provider key or null if none enabled
   */
  getTextProvider() {
    return this.providerManager.getTextProvider();
  }

  /**
   * Get a specific provider instance
   * @param {string} providerName - Name of the provider (comfyui, stability, etc.)
   * @returns {Object|null} Provider instance or null if not found
   */
  async getProvider(providerName) {
    // Ensure config is loaded
    await loadConfig();
    if (configCache && configCache !== this.config) {
      this.config = configCache;
      this.providerManager = new ProviderManager(this.config);
      this.providers = {
        openrouter: new OpenRouterProvider(
          this.config.providers?.openrouter || {},
        ),
        stability: new StabilityProvider(
          this.config.providers?.stability || {},
        ),
        runpod: new RunPodServerlessProvider(
          this.config.providers?.runpod || {},
        ),
        comfyui: new ComfyUIProvider(this.config.providers?.comfyui || {}),
      };
    }

    return this.providers[providerName] || null;
  }

  /**
   * Generate AI content using the configured provider
   * @param {Object} options - Configuration options
   * @param {string} options.type - Type of generation (image, text)
   * @param {string} options.prompt - Input prompt
   * @param {Object} options.config - Additional configuration
   * @param {string} options.provider - Force specific provider (optional)
   * @returns {Promise<Object>} Generated content
   */
  async generate(options) {
    // Ensure config is loaded before generating
    await loadConfig();
    if (configCache && configCache !== this.config) {
      this.config = configCache;
      this.providerManager = new ProviderManager(this.config);
      this.providers = {
        openrouter: new OpenRouterProvider(
          this.config.providers?.openrouter || {},
        ),
        stability: new StabilityProvider(
          this.config.providers?.stability || {},
        ),
        runpod: new RunPodServerlessProvider(
          this.config.providers?.runpod || {},
        ),
        comfyui: new ComfyUIProvider(this.config.providers?.comfyui || {}),
      };
    }

    const {
      type = "image",
      prompt,
      config: genConfig = {},
      provider = null,
      progressCallback = null,
    } = options;

    // Determine which provider to use based on generation type
    let targetProvider = provider;

    if (!targetProvider) {
      // Route to appropriate provider based on type
      if (type === "image") {
        // Pass NSFW flag for smart provider routing
        const isNSFW = genConfig.isNSFW || false;
        targetProvider = this.getImageProvider(isNSFW);
        if (!targetProvider) {
          throw new Error(
            "Image generation is currently unavailable. No image generation service is configured.",
          );
        }
      } else if (type === "text" || type === "chat") {
        targetProvider = this.providerManager.getTextProvider();
        if (!targetProvider) {
          throw new Error(
            "AI chat is currently unavailable. No chat service is configured.",
          );
        }
      } else {
        // Fallback to primary provider for unknown types
        targetProvider = this.providerManager.getPrimaryProvider();
        if (!targetProvider) {
          throw new Error(
            "AI features are currently disabled. All AI services are unavailable.",
          );
        }
      }
    }

    const providerConfig = this.config.providers[targetProvider];

    if (!providerConfig) {
      throw new Error(
        "The AI service encountered an internal error. This feature is temporarily unavailable.",
      );
    }

    // Check if provider is enabled (only if explicitly forced)
    if (provider && providerConfig.enabled !== true) {
      throw new Error(
        "The requested AI service is currently unavailable. This feature is temporarily disabled.",
      );
    }

    // API key is optional for self-hosted providers (e.g., ComfyUI)
    if (
      targetProvider !== "selfhosted" &&
      targetProvider !== "comfyui" &&
      !providerConfig.apiKey
    ) {
      throw new Error(
        `The ${providerConfig.name} service is not properly configured. This feature is temporarily unavailable.`,
      );
    }

    const startTime = Date.now();

    // ONLY use the exact configured provider - NO FALLBACKS

    // Try ONLY the configured provider - NO FALLBACKS OR RETRIES
    const currentProvider = targetProvider;
    const currentProviderConfig = this.config.providers[currentProvider];

    if (!currentProviderConfig || !currentProviderConfig.enabled) {
      throw new Error(
        `The configured AI provider '${currentProvider}' is not enabled. Please check your AI configuration.`,
      );
    }

    if (
      currentProvider !== "selfhosted" &&
      currentProvider !== "comfyui" &&
      !currentProviderConfig.apiKey
    ) {
      throw new Error(
        `The configured AI provider '${currentProvider}' is missing API key. Please configure the API key.`,
      );
    }

    try {
      logger.debug(
        `Using ${currentProviderConfig.name} for ${type} generation (NO FALLBACKS)`,
      );

      let result;

      if (type === "image") {
        result = await this.generateImage(
          prompt,
          genConfig,
          currentProvider,
          progressCallback,
        );
      } else if (type === "text" || type === "chat") {
        result = await this.generateText(prompt, genConfig, currentProvider);
      } else {
        throw new Error(
          "The AI service encountered an internal error. This feature is temporarily unavailable.",
        );
      }

      const responseTime = Date.now() - startTime;

      // Record successful request
      performanceMonitor.recordRequest({
        provider: currentProvider,
        responseTime,
        success: true,
      });

      logger.info(
        `AI generation completed using ${currentProviderConfig.name} in ${responseTime}ms (NO FALLBACKS)`,
      );
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request
      performanceMonitor.recordRequest({
        provider: currentProvider,
        responseTime,
        success: false,
        error: error.message,
      });

      logger.error(
        `AI generation failed with ${currentProviderConfig.name}: ${error.message} (NO FALLBACKS - FAILING)`,
      );

      // NO FALLBACKS - throw the error immediately
      throw error;
    }
  }

  /**
   * Generate image using specified provider - NO FALLBACKS
   * @param {string} prompt - Image generation prompt
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, config, provider, progressCallback = null) {
    // Get model from feature-based config - ONLY use the exact configured model
    const isNSFW = config.isNSFW || false;

    // Use the feature name from config if provided, otherwise determine based on NSFW flag
    let featureName = config.featureName;
    if (!featureName) {
      featureName = isNSFW ? "imagineNSFW" : "imagineGeneral";
    }

    const feature = this.config.features?.[featureName];

    // ONLY use the exact configured model for this feature - NO FALLBACKS
    const model = feature?.model;

    // If no model configured in feature, fail - NO FALLBACKS
    if (!model) {
      throw new Error(
        `No model configured for feature ${featureName}. Please configure a model in the AI settings.`,
      );
    }

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.MULTIPROVIDER_INITIALIZING);
    }

    // Log feature and model selection
    const { getLogger } = await import("../logger.js");
    const logger = getLogger();
    logger.info(
      `[MULTIPROVIDER] Feature: ${featureName} | Model: ${model} | Provider: ${provider}`,
    );

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new Error(
        "The image generation service encountered an internal error. This feature is temporarily unavailable.",
      );
    }

    // Pass feature name to provider for model selection
    const enhancedConfig = {
      ...config,
      featureName,
    };

    return providerInstance.generateImage(
      prompt,
      model,
      enhancedConfig,
      progressCallback,
    );
  }

  /**
   * Generate text/chat using specified provider - NO FALLBACKS
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, config, provider) {
    // Get model from feature-based config - ONLY use the exact configured model
    let model = config.model; // Use provided model first

    if (!model && this.providerManager) {
      // Try to get model from aiChat feature
      const feature = this.config.features?.aiChat;
      model = feature?.model;
    }

    // If no model configured, fail - NO FALLBACKS
    if (!model) {
      throw new Error(
        "No model configured for AI chat. Please configure a model in the AI settings.",
      );
    }

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new Error(
        "The AI chat service encountered an internal error. This feature is temporarily unavailable.",
      );
    }

    return providerInstance.generateText(prompt, model, config);
  }

  /**
   * Generate streaming AI text response
   * @param {Object} options - Configuration options
   * @param {string|Array} options.prompt - Input prompt (string or messages array)
   * @param {string} options.model - Model name
   * @param {Object} options.config - Additional configuration
   * @param {string} options.provider - Provider name
   * @param {Function} options.onChunk - Callback for each chunk (chunk: string) => void
   * @returns {Promise<Object>} Final response with full text
   */
  async generateTextStreaming(options) {
    const { prompt, model, config = {}, provider, onChunk } = options;

    if (!onChunk || typeof onChunk !== "function") {
      throw new Error("onChunk callback is required for streaming");
    }

    if (!provider) {
      throw new Error("Provider is required for streaming");
    }

    const providerInstance = this.providers[provider];
    if (
      !providerInstance ||
      typeof providerInstance.generateTextStreaming !== "function"
    ) {
      throw new Error(`Streaming not supported for provider: ${provider}`);
    }

    return providerInstance.generateTextStreaming(
      prompt,
      model,
      config,
      onChunk,
    );
  }

  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      primary: this.providerManager.getPrimaryProvider(),
      providers: Object.keys(this.config.providers || {}),
      enabledProviders: Object.entries(this.config.providers || {})
        .filter(([, provider]) => provider.enabled === true)
        .map(([key]) => key),
    };
  }
}

// Export singleton instance
export const multiProviderAIService = new MultiProviderAIService();
