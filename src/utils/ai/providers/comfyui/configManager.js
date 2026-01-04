/**
 * ComfyUI Configuration Manager
 * Handles configuration validation, loading, and management
 */

import { getLogger } from "../../../logger.js";

const logger = getLogger();

export class ConfigManager {
  constructor() {
    this.config = null;
    this.validationRules = this.initializeValidationRules();
  }

  /**
   * Initialize validation rules
   */
  initializeValidationRules() {
    return {
      providers: {
        comfyui: {
          required: ["enabled"],
          optional: ["baseUrl", "apiKey", "workflowId", "nsfwWorkflow"],
          validation: {
            enabled: value => typeof value === "boolean",
            baseUrl: value =>
              typeof value === "string" && value.startsWith("http"),
            apiKey: value => !value || typeof value === "string",
            workflowId: value => !value || typeof value === "string",
            nsfwWorkflow: value => !value || typeof value === "string",
          },
        },
        runpod: {
          required: ["enabled"],
          optional: ["apiKey", "endpointId", "timeout", "maxRetries"],
          validation: {
            enabled: value => typeof value === "boolean",
            apiKey: value => !value || typeof value === "string",
            endpointId: value => !value || typeof value === "string",
            timeout: value =>
              !value || (typeof value === "number" && value > 0),
            maxRetries: value =>
              !value || (typeof value === "number" && value >= 0),
          },
        },
      },
      features: {
        imagineNSFW: {
          required: ["enabled", "provider"],
          optional: ["model", "allowNSFWProviders"],
          validation: {
            enabled: value => typeof value === "boolean",
            provider: value => typeof value === "string",
            model: value => !value || typeof value === "string",
            allowNSFWProviders: value => typeof value === "boolean",
          },
        },
      },
    };
  }

  /**
   * Load and validate configuration
   */
  async loadConfig(aiConfig) {
    try {
      this.config = aiConfig;
      const validation = this.validateConfig(aiConfig);

      if (!validation.valid) {
        logger.error(
          "[ConfigManager] Configuration validation failed:",
          validation.errors,
        );
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(", ")}`,
        );
      }

      if (validation.warnings.length > 0) {
        logger.warn(
          "[ConfigManager] Configuration warnings:",
          validation.warnings,
        );
      }

      logger.info(
        "[ConfigManager] Configuration loaded and validated successfully",
      );
      return {
        success: true,
        config: this.config,
        warnings: validation.warnings,
      };
    } catch (error) {
      logger.error("[ConfigManager] Failed to load configuration:", error);
      throw error;
    }
  }

  /**
   * Validate configuration against rules
   */
  validateConfig(config) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate providers
    if (config.providers) {
      for (const [providerName, providerConfig] of Object.entries(
        config.providers,
      )) {
        const rules = this.validationRules.providers[providerName];
        if (rules) {
          const providerValidation = this.validateSection(
            providerConfig,
            rules,
            `providers.${providerName}`,
          );
          validation.errors.push(...providerValidation.errors);
          validation.warnings.push(...providerValidation.warnings);
        }
      }
    }

    // Validate features
    if (config.features) {
      for (const [featureName, featureConfig] of Object.entries(
        config.features,
      )) {
        const rules = this.validationRules.features[featureName];
        if (rules) {
          const featureValidation = this.validateSection(
            featureConfig,
            rules,
            `features.${featureName}`,
          );
          validation.errors.push(...featureValidation.errors);
          validation.warnings.push(...featureValidation.warnings);
        }
      }
    }

    // Cross-validation checks
    this.performCrossValidation(config, validation);

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  /**
   * Validate a configuration section
   */
  validateSection(sectionConfig, rules, sectionPath) {
    const validation = {
      errors: [],
      warnings: [],
    };

    // Skip validation if section config is null or undefined
    if (!sectionConfig) {
      validation.warnings.push(`${sectionPath} is not configured`);
      return validation;
    }

    // Check required fields
    for (const requiredField of rules.required) {
      if (!(requiredField in sectionConfig)) {
        validation.errors.push(`${sectionPath}.${requiredField} is required`);
      }
    }

    // Validate field values
    for (const [field, value] of Object.entries(sectionConfig)) {
      const validator = rules.validation[field];
      if (validator && !validator(value)) {
        validation.errors.push(
          `${sectionPath}.${field} has invalid value: ${value}`,
        );
      }
    }

    return validation;
  }

  /**
   * Perform cross-validation checks
   */
  performCrossValidation(config, validation) {
    // Check if NSFW feature is enabled but no NSFW providers are available
    const nsfwFeature = config.features?.imagineNSFW;
    if (nsfwFeature?.enabled) {
      const hasNSFWProvider =
        config.providers?.comfyui?.enabled || config.providers?.runpod?.enabled;

      if (!hasNSFWProvider) {
        validation.errors.push(
          "NSFW feature is enabled but no NSFW-capable providers are available",
        );
      }
    }

    // Check if ComfyUI is enabled but baseUrl is not set
    const comfyuiProvider = config.providers?.comfyui;
    if (comfyuiProvider?.enabled && !comfyuiProvider.baseUrl) {
      validation.warnings.push(
        "ComfyUI is enabled but baseUrl is not set, using default",
      );
    }

    // Check if RunPod is enabled but credentials are missing
    const runpodProvider = config.providers?.runpod;
    if (runpodProvider?.enabled) {
      if (!runpodProvider.runPod?.apiKey) {
        validation.errors.push("RunPod is enabled but apiKey is missing");
      }
      if (!runpodProvider.runPod?.endpointId) {
        validation.errors.push("RunPod is enabled but endpointId is missing");
      }
    }
  }

  /**
   * Get configuration value with fallback
   */
  getConfig(path, fallback = null) {
    if (!this.config) {
      return fallback;
    }

    const keys = path.split(".");
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return fallback;
      }
    }

    return current;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerName) {
    return this.getConfig(`providers.${providerName}`, {});
  }

  /**
   * Get feature configuration
   */
  getFeatureConfig(featureName) {
    return this.getConfig(`features.${featureName}`, {});
  }

  /**
   * Check if provider is enabled
   */
  isProviderEnabled(providerName) {
    return this.getConfig(`providers.${providerName}.enabled`, false);
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.getConfig(`features.${featureName}.enabled`, false);
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || "development";

    return {
      environment: env,
      isDevelopment: env === "development",
      isProduction: env === "production",
      comfyuiUrl: process.env.COMFYUI_API_URL || "http://127.0.0.1:8188",
      runpodApiKey: process.env.RUNPOD_API_KEY,
      runpodEndpointId: process.env.RUNPOD_ENDPOINT_ID,
      runpodEnabled: process.env.RUNPOD_ENABLED === "true",
    };
  }

  /**
   * Merge environment variables with configuration
   */
  mergeEnvironmentConfig(config) {
    const envConfig = this.getEnvironmentConfig();
    const mergedConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Override ComfyUI URL from environment
    if (mergedConfig.providers?.comfyui && envConfig.comfyuiUrl) {
      mergedConfig.providers.comfyui.baseUrl = envConfig.comfyuiUrl;
    }

    // Override RunPod configuration from environment
    if (mergedConfig.providers?.runpod) {
      if (envConfig.runpodApiKey) {
        mergedConfig.providers.runpod.runPod =
          mergedConfig.providers.runpod.runPod || {};
        mergedConfig.providers.runpod.runPod.apiKey = envConfig.runpodApiKey;
      }
      if (envConfig.runpodEndpointId) {
        mergedConfig.providers.runpod.runPod =
          mergedConfig.providers.runpod.runPod || {};
        mergedConfig.providers.runpod.runPod.endpointId =
          envConfig.runpodEndpointId;
      }
      if (envConfig.runpodEnabled !== undefined) {
        mergedConfig.providers.runpod.enabled = envConfig.runpodEnabled;
      }
    }

    return mergedConfig;
  }

  /**
   * Get configuration summary
   */
  getConfigSummary() {
    if (!this.config) {
      return { loaded: false };
    }

    const summary = {
      loaded: true,
      providers: {},
      features: {},
      environment: this.getEnvironmentConfig(),
    };

    // Summarize providers
    if (this.config.providers) {
      for (const [name, config] of Object.entries(this.config.providers)) {
        summary.providers[name] = {
          enabled: config.enabled,
          configured: this.isProviderConfigured(name, config),
        };
      }
    }

    // Summarize features
    if (this.config.features) {
      for (const [name, config] of Object.entries(this.config.features)) {
        summary.features[name] = {
          enabled: config.enabled,
          provider: config.provider,
        };
      }
    }

    return summary;
  }

  /**
   * Check if provider is properly configured
   */
  isProviderConfigured(providerName, config) {
    switch (providerName) {
      case "comfyui":
        return config.enabled && config.baseUrl;
      case "runpod":
        return (
          config.enabled && config.runPod?.apiKey && config.runPod?.endpointId
        );
      default:
        return config.enabled;
    }
  }

  /**
   * Reset configuration
   */
  reset() {
    this.config = null;
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
export default configManager;
