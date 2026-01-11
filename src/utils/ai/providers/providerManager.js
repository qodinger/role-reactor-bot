/**
 * Provider Manager - Feature-Based Design
 * Handles provider selection based on specific features and content types
 */
export class ProviderManager {
  constructor(config) {
    this.config = config;
  }

  /**
   * Check if AI features are enabled (at least one feature is enabled)
   * @returns {boolean} True if AI is available
   */
  isEnabled() {
    if (!this.config.features) return false;

    return Object.values(this.config.features).some(
      feature => feature.enabled && this.isProviderAvailable(feature.provider),
    );
  }

  /**
   * Check if a provider is available (enabled and has API key if required)
   * @param {string} providerKey - Provider key
   * @returns {boolean} True if provider is available
   */
  isProviderAvailable(providerKey) {
    const provider = this.config.providers[providerKey];
    if (!provider || !provider.enabled) return false;

    // Self-hosted providers (ComfyUI) don't require API key
    if (providerKey === "comfyui") return true;

    // RunPod requires both API key and endpoint ID
    if (providerKey === "runpod") {
      return !!(provider.apiKey && provider.endpointId);
    }

    // Other providers require API key
    return !!provider.apiKey;
  }

  /**
   * Check if a provider is safe for the requested content type
   * @param {string} providerKey - Provider key
   * @param {boolean} isNSFW - Whether content is NSFW
   * @returns {boolean} True if provider is safe for this content type
   */
  isProviderSafeForContent(providerKey, isNSFW = false) {
    const provider = this.config.providers[providerKey];
    if (!provider) return false;

    const safetyLevel = provider.safetyLevel || "safe";

    if (isNSFW) {
      // For NSFW content, allow any provider (safe, mixed, or nsfw)
      return true;
    } else {
      // For safe content, only allow "safe" providers
      // Never allow "mixed" or "nsfw" providers for safe content
      return safetyLevel === "safe";
    }
  }

  /**
   * Get the appropriate provider for a specific feature with optional fallbacks
   * @param {string} featureName - Feature name (aiChat, avatar, imagineGeneral, imagineNSFW)
   * @returns {string|null} Provider key or null if not available
   */
  getProviderForFeature(featureName) {
    const feature = this.config.features[featureName];
    if (!feature || !feature.enabled) return null;

    // Determine if this is NSFW content based on feature name
    const isNSFW = featureName === "imagineNSFW";

    // For safe content features, enforce strict safety if configured
    const enforceSafety = !isNSFW && feature.allowNSFWProviders === false;

    // Handle "auto" provider selection with fallbacks
    if (feature.provider === "auto") {
      // For NSFW content, try RunPod first, then ComfyUI (never Stability)
      if (isNSFW) {
        const fallbackOrder = ["runpod", "comfyui"];
        for (const providerKey of fallbackOrder) {
          if (this.isProviderAvailable(providerKey) && 
              this.isProviderSafeForContent(providerKey, isNSFW)) {
            return providerKey;
          }
        }
      } else {
        // For safe content, only use Stability AI (never NSFW providers)
        const fallbackOrder = ["stability"];
        for (const providerKey of fallbackOrder) {
          if (this.isProviderAvailable(providerKey) && 
              this.isProviderSafeForContent(providerKey, isNSFW)) {
            return providerKey;
          }
        }
      }
      return null;
    }

    // ONLY try the configured provider - NO FALLBACKS for specific providers
    if (this.isProviderAvailable(feature.provider)) {
      if (
        !enforceSafety ||
        this.isProviderSafeForContent(feature.provider, isNSFW)
      ) {
        return feature.provider;
      }
    }

    // If the configured provider is not available or not safe, return null
    return null;
  }

  /**
   * Get the appropriate provider for image generation based on content type
   * @param {boolean} isNSFW - Whether content is NSFW
   * @returns {string|null} Provider key or null if none enabled
   */
  getImageProvider(isNSFW = false) {
    const featureName = isNSFW ? "imagineNSFW" : "imagineGeneral";
    return this.getProviderForFeature(featureName);
  }

  /**
   * Get the appropriate provider for text/chat generation
   * @returns {string|null} Provider key or null if none enabled
   */
  getTextProvider() {
    return this.getProviderForFeature("aiChat");
  }

  /**
   * Get the appropriate provider for avatar generation
   * @returns {string|null} Provider key or null if none enabled
   */
  getAvatarProvider() {
    return this.getProviderForFeature("avatar");
  }

  /**
   * Get the first enabled provider in priority order (legacy compatibility)
   * @returns {string|null} Provider key or null if none enabled
   */
  getPrimaryProvider() {
    // Check all features to find any available provider
    const features = ["imagineGeneral", "aiChat", "avatar", "imagineNSFW"];

    for (const featureName of features) {
      const provider = this.getProviderForFeature(featureName);
      if (provider) return provider;
    }

    return null;
  }

  /**
   * Get model/checkpoint for a specific feature
   * @param {string} featureName - Feature name
   * @returns {string|null} Model name or null if not found
   */
  getModelForFeature(featureName) {
    const feature = this.config.features[featureName];
    if (!feature || !feature.enabled) return null;

    return feature.model;
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
   * @returns {boolean} True if enabled
   */
  isProviderEnabled(providerKey) {
    const provider = this.config.providers[providerKey];
    return !!(provider && provider.enabled);
  }

  /**
   * Get feature configuration
   * @param {string} featureName - Feature name
   * @returns {Object|null} Feature configuration or null if not found
   */
  getFeatureConfig(featureName) {
    return this.config.features[featureName] || null;
  }

  /**
   * Get all enabled features
   * @returns {Array} Array of enabled feature names
   */
  getEnabledFeatures() {
    if (!this.config.features) return [];

    return Object.keys(this.config.features).filter(
      featureName => this.config.features[featureName].enabled,
    );
  }

  /**
   * Get all available providers for a feature
   * @param {string} featureName - Feature name
   * @returns {Array} Array of available provider keys
   */
  getAvailableProvidersForFeature(featureName) {
    const feature = this.config.features[featureName];
    if (!feature || !feature.enabled) return [];

    const providers = [];

    // Add primary provider
    if (this.isProviderAvailable(feature.provider)) {
      providers.push(feature.provider);
    }

    // Add fallback provider
    if (
      feature.fallbackProvider &&
      this.isProviderAvailable(feature.fallbackProvider)
    ) {
      providers.push(feature.fallbackProvider);
    }

    // Add alternative providers
    if (feature.alternativeProviders) {
      for (const altProvider of feature.alternativeProviders) {
        if (
          this.isProviderAvailable(altProvider) &&
          !providers.includes(altProvider)
        ) {
          providers.push(altProvider);
        }
      }
    }

    return providers;
  }

  /**
   * Get all enabled providers (legacy compatibility)
   * @returns {Array<string>} Array of enabled provider keys
   */
  getEnabledProviders() {
    return Object.entries(this.config.providers)
      .filter(([, provider]) => provider.enabled === true)
      .map(([key]) => key);
  }
}
