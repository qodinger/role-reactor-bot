/**
 * Provider Manager
 * Handles provider selection and management logic
 */
export class ProviderManager {
  constructor(config) {
    this.config = config;
  }

  /**
   * Check if AI features are enabled (at least one provider is enabled)
   * @returns {boolean} True if AI is available
   */
  isEnabled() {
    return this.getPrimaryProvider() !== null;
  }

  /**
   * Get the first enabled provider in priority order
   * @returns {string|null} Provider key or null if none enabled
   */
  getPrimaryProvider() {
    for (const [key, provider] of Object.entries(this.config.providers)) {
      if (provider.enabled === true) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get the appropriate provider for image generation
   * Prefers ComfyUI, then Stability AI, then OpenAI, then OpenRouter
   * @returns {string|null} Provider key or null if none enabled
   */
  getImageProvider() {
    const imageProviders = [
      "runpod",
      "comfyui",
      "stability",
      "openai",
      "openrouter",
    ];

    for (const key of imageProviders) {
      const provider = this.config.providers[key];
      if (provider && provider.enabled === true) {
        // RunPod requires endpoint ID
        if (key === "runpod") {
          if (provider.endpointId && provider.apiKey) {
            return key;
          }
        }
        // ComfyUI doesn't require API key (optional)
        else if (key === "comfyui") {
          return key;
        }
        // Others require API key
        else if (provider.apiKey) {
          return key;
        }
      }
    }

    return null;
  }

  /**
   * Get the appropriate provider for text/chat generation
   * Prefers OpenRouter, then OpenAI
   * @returns {string|null} Provider key or null if none enabled
   */
  getTextProvider() {
    // For text/chat, prefer OpenRouter, then OpenAI
    const textProviders = ["openrouter", "openai"];

    for (const key of textProviders) {
      const provider = this.config.providers[key];
      if (provider && provider.enabled === true) {
        // Require API key
        if (provider.apiKey) {
          return key;
        }
      }
    }

    return null;
  }

  /**
   * Get provider configuration
   * @param {string} providerKey - Provider key
   * @returns {Object|null} Provider configuration or null if not found
   */
  getProviderConfig(providerKey) {
    return this.config.providers[providerKey] || null;
  }

  /**
   * Check if a provider is enabled
   * @param {string} providerKey - Provider key
   * @returns {boolean} True if provider is enabled
   */
  isProviderEnabled(providerKey) {
    const provider = this.config.providers[providerKey];
    return provider && provider.enabled === true;
  }

  /**
   * Get all enabled providers
   * @returns {Array<string>} Array of enabled provider keys
   */
  getEnabledProviders() {
    return Object.entries(this.config.providers)
      .filter(([, provider]) => provider.enabled === true)
      .map(([key]) => key);
  }
}
