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
   * Skips self-hosted (Ollama doesn't do images) and prefers Stability AI
   * @returns {string|null} Provider key or null if none enabled
   */
  getImageProvider() {
    // For images, prefer Stability AI, then OpenAI, then OpenRouter
    // Skip self-hosted as it's for text/chat only
    const imageProviders = ["stability", "openai", "openrouter"];

    for (const key of imageProviders) {
      const provider = this.config.providers[key];
      if (provider && provider.enabled === true && provider.apiKey) {
        return key;
      }
    }

    return null;
  }

  /**
   * Get the appropriate provider for text/chat generation
   * Prefers self-hosted (Ollama) for local AI, then falls back to others
   * @returns {string|null} Provider key or null if none enabled
   */
  getTextProvider() {
    // For text/chat, prefer self-hosted (Ollama), then OpenRouter, then OpenAI
    const textProviders = ["selfhosted", "openrouter", "openai"];

    for (const key of textProviders) {
      const provider = this.config.providers[key];
      if (provider && provider.enabled === true) {
        // For self-hosted, API key is optional
        if (key === "selfhosted") {
          return key;
        }
        // For others, require API key
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
