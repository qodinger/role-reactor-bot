import config from "../../config/config.js";
import { getLogger } from "../logger.js";
import {
  PROVIDER_FALLBACK_ENABLED,
  PROVIDER_RETRY_ATTEMPTS,
  PROVIDER_RETRY_DELAY,
} from "./constants.js";
import { performanceMonitor } from "./performanceMonitor.js";
import { ProviderManager } from "./providers/providerManager.js";
import { OpenRouterProvider } from "./providers/openRouterProvider.js";
import { OpenAIProvider } from "./providers/openAIProvider.js";
import { StabilityProvider } from "./providers/stabilityProvider.js";
import { SelfHostedProvider } from "./providers/selfHostedProvider.js";

const logger = getLogger();

/**
 * Multi-provider AI service supporting both OpenRouter and OpenAI
 */
export class MultiProviderAIService {
  constructor() {
    this.config = config.aiModels;
    this.providerManager = new ProviderManager(this.config);

    // Initialize provider instances
    this.providers = {
      openrouter: new OpenRouterProvider(this.config.providers.openrouter),
      openai: new OpenAIProvider(this.config.providers.openai),
      stability: new StabilityProvider(this.config.providers.stability),
      selfhosted: new SelfHostedProvider(this.config.providers.selfhosted),
    };
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
   * Skips self-hosted (Ollama doesn't do images) and prefers Stability AI
   * @returns {string|null} Provider key or null if none enabled
   */
  getImageProvider() {
    return this.providerManager.getImageProvider();
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
   * Generate AI content using the configured provider
   * @param {Object} options - Configuration options
   * @param {string} options.type - Type of generation (image, text)
   * @param {string} options.prompt - Input prompt
   * @param {Object} options.config - Additional configuration
   * @param {string} options.provider - Force specific provider (optional)
   * @returns {Promise<Object>} Generated content
   */
  async generate(options) {
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
        targetProvider = this.getImageProvider();
        if (!targetProvider) {
          throw new Error(
            "No image generation provider available. Please enable Stability AI, OpenAI, or OpenRouter in config.js and configure their API keys.",
          );
        }
      } else if (type === "text" || type === "chat") {
        targetProvider = this.providerManager.getTextProvider();
        if (!targetProvider) {
          throw new Error(
            "No text/chat provider available. Please enable self-hosted (Ollama), OpenRouter, or OpenAI in config.js and configure their API keys if needed.",
          );
        }
      } else {
        // Fallback to primary provider for unknown types
        targetProvider = this.providerManager.getPrimaryProvider();
        if (!targetProvider) {
          throw new Error(
            "AI features are disabled. All providers are disabled. Please enable at least one provider in config.js to use AI features.",
          );
        }
      }
    }

    const providerConfig = this.config.providers[targetProvider];

    if (!providerConfig) {
      throw new Error(`Unknown AI provider: ${targetProvider}`);
    }

    // Check if provider is enabled (only if explicitly forced)
    if (provider && providerConfig.enabled !== true) {
      throw new Error(
        `${providerConfig.name} is disabled. Please enable it in config or use a different provider.`,
      );
    }

    // API key is optional for self-hosted providers (e.g., Automatic1111)
    if (targetProvider !== "selfhosted" && !providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    const startTime = Date.now();
    let lastError = null;
    const attemptedProviders = new Set();

    // Try primary provider first, then fallback to others if enabled
    const providersToTry = [targetProvider];
    if (PROVIDER_FALLBACK_ENABLED && !provider) {
      // Add fallback providers in priority order
      if (type === "image") {
        const fallbacks = ["stability", "openai", "openrouter"];
        for (const fallback of fallbacks) {
          if (
            fallback !== targetProvider &&
            this.config.providers[fallback]?.enabled &&
            this.config.providers[fallback]?.apiKey
          ) {
            providersToTry.push(fallback);
          }
        }
      } else if (type === "text" || type === "chat") {
        const fallbacks = ["selfhosted", "openrouter", "openai"];
        for (const fallback of fallbacks) {
          if (
            fallback !== targetProvider &&
            this.config.providers[fallback]?.enabled
          ) {
            if (
              fallback === "selfhosted" ||
              this.config.providers[fallback]?.apiKey
            ) {
              providersToTry.push(fallback);
            }
          }
        }
      }
    }

    // Try each provider until one succeeds
    for (
      let attempt = 0;
      attempt < Math.min(providersToTry.length, PROVIDER_RETRY_ATTEMPTS + 1);
      attempt++
    ) {
      const currentProvider = providersToTry[attempt];
      const currentProviderConfig = this.config.providers[currentProvider];

      if (!currentProviderConfig || !currentProviderConfig.enabled) {
        continue;
      }

      if (currentProvider !== "selfhosted" && !currentProviderConfig.apiKey) {
        continue;
      }

      if (attemptedProviders.has(currentProvider)) {
        continue; // Already tried this provider
      }

      attemptedProviders.add(currentProvider);

      try {
        logger.debug(
          `Using ${currentProviderConfig.name} for ${type} generation${attempt > 0 ? ` (fallback attempt ${attempt})` : ""}`,
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
            `Unsupported generation type: ${type}. Supported types: 'image', 'text', 'chat'.`,
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
          `AI generation completed using ${currentProviderConfig.name} in ${responseTime}ms${attempt > 0 ? ` (after ${attempt} fallback attempt(s))` : ""}`,
        );
        return result;
      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - startTime;

        // Record failed request
        performanceMonitor.recordRequest({
          provider: currentProvider,
          responseTime,
          success: false,
          error: error.message,
        });

        logger.warn(
          `AI generation failed with ${currentProviderConfig.name}: ${error.message}${attempt < providersToTry.length - 1 ? " - trying fallback provider..." : ""}`,
        );

        // If there are more providers to try, wait before retrying
        if (attempt < providersToTry.length - 1) {
          await new Promise(resolve => {
            setTimeout(() => {
              resolve();
            }, PROVIDER_RETRY_DELAY);
          });
        }
      }
    }

    // All providers failed
    logger.error(
      `AI generation failed with all providers (${attemptedProviders.size} attempted)`,
    );
    throw lastError || new Error("All AI providers failed");
  }

  /**
   * Generate image using specified provider
   * @param {string} prompt - Image generation prompt
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, config, provider, progressCallback = null) {
    const providerConfig = this.config.providers[provider];
    const model = providerConfig.models.image.primary;

    if (progressCallback) {
      progressCallback("Initializing image generation...");
    }

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new Error(`Unsupported provider for image generation: ${provider}`);
    }

    return providerInstance.generateImage(
      prompt,
      model,
      config,
      progressCallback,
    );
  }

  /**
   * Generate text/chat using specified provider
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, config, provider) {
    const providerConfig = this.config.providers[provider];
    const model = providerConfig.models?.text?.primary || config.model;

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new Error(`Unsupported provider for text generation: ${provider}`);
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
      providers: Object.keys(this.config.providers),
      enabledProviders: Object.entries(this.config.providers)
        .filter(([, provider]) => provider.enabled === true)
        .map(([key]) => key),
    };
  }
}

// Export singleton instance
export const multiProviderAIService = new MultiProviderAIService();
