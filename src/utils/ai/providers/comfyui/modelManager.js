/**
 * ComfyUI Model Manager
 * Handles model selection between animagine and anything models
 */

import { getLogger } from "../../../logger.js";

const logger = getLogger();

export class ModelManager {
  constructor() {
    this.models = new Map();
    this.initialized = false;
  }

  /**
   * Initialize model configurations
   */
  initialize() {
    if (this.initialized) return;

    // Simplified model configurations - only animagine and anything
    const modelConfigs = {
      // Animagine XL 4.0 - Best quality with NSFW filter bypass
      "animagine-xl-4.0-opt.safetensors": {
        name: "Animagine XL 4.0",
        key: "animagine",
        workflow: "animagine.json",
        description: "High-quality anime model with superior character knowledge",
        defaultSettings: {
          steps: 28,        // Optimal for Animagine
          cfg: 5.0,         // Optimal for Animagine
          sampler: "dpmpp_2m",
          scheduler: "karras",
        },
      },

      // Anything XL - Uncensored anime model
      "AnythingXL_xl.safetensors": {
        name: "Anything XL",
        key: "anything",
        workflow: "anything.json",
        description: "Uncensored anime model with versatile style",
        defaultSettings: {
          steps: 20,        // Optimal for Anything XL
          cfg: 7.0,         // Optimal for Anything XL
          sampler: "dpmpp_2m",
          scheduler: "karras",
        },
      },
    };

    // Store models with their configurations
    for (const [filename, config] of Object.entries(modelConfigs)) {
      this.models.set(filename, config);
    }

    this.initialized = true;
    logger.info(
      `[ModelManager] Initialized ${this.models.size} model configurations`,
    );
  }

  /**
   * Get model by key (animagine or anything)
   */
  getModelByKey(modelKey) {
    this.initialize();

    // Default to animagine if no key specified
    if (!modelKey) {
      modelKey = "animagine";
    }

    // Find model by key
    for (const [filename, config] of this.models.entries()) {
      if (config.key === modelKey.toLowerCase()) {
        return {
          filename,
          ...config,
        };
      }
    }

    // Fallback to animagine
    const animagineFilename = "animagine-xl-4.0-opt.safetensors";
    return {
      filename: animagineFilename,
      ...this.models.get(animagineFilename),
    };
  }

  /**
   * Get model by exact filename
   */
  getModelByFilename(filename) {
    this.initialize();

    const config = this.models.get(filename);
    if (!config) {
      throw new Error(`Model '${filename}' not found`);
    }

    return {
      filename,
      ...config,
    };
  }

  /**
   * Parse command flags and return model selection
   */
  parseModelFlags(commandText) {
    this.initialize();

    // Check for model flags
    const modelPatterns = {
      animagine: /--(?:model|m)\s+animagine|--animagine/i,
      anything: /--(?:model|m)\s+anything|--anything/i,
    };

    // Check for specific model flags
    if (modelPatterns.animagine.test(commandText)) {
      return this.getModelByKey("animagine");
    }
    if (modelPatterns.anything.test(commandText)) {
      return this.getModelByKey("anything");
    }

    // Default to animagine (best quality)
    return this.getModelByKey("animagine");
  }

  /**
   * Get all available models
   */
  getAvailableModels() {
    this.initialize();

    return Array.from(this.models.entries()).map(([filename, config]) => ({
      filename,
      ...config,
    }));
  }

  /**
   * Get optimal settings for a model
   */
  getOptimalSettings(modelKey, userSteps = null, userCfg = null) {
    const model = this.getModelByKey(modelKey);
    
    return {
      steps: userSteps || model.defaultSettings.steps,
      cfg: userCfg || model.defaultSettings.cfg,
      sampler: model.defaultSettings.sampler,
      scheduler: model.defaultSettings.scheduler,
    };
  }

  /**
   * Validate model configuration
   */
  validateModel(filename) {
    this.initialize();

    const model = this.models.get(filename);
    if (!model) {
      return {
        valid: false,
        error: `Model '${filename}' not found`,
      };
    }

    return {
      valid: true,
      model,
    };
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
export default modelManager;
