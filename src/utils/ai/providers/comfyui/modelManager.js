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
      // Animagine XL 4.0 - Best quality anime
      "animagine-xl-4.0-opt.safetensors": {
        name: "Animagine XL 4.0",
        key: "animagine",
        workflow: "animagine.json",
        description:
          "High-quality anime model with superior character knowledge",
        defaultSettings: {
          steps: 25,
          cfg: 7.0,
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
        },
      },

      // Anything XL - Versatile anime
      "AnythingXL_xl.safetensors": {
        name: "Anything XL",
        key: "anything",
        workflow: "anything.json",
        description: "Uncensored anime model with versatile style",
        defaultSettings: {
          steps: 30,
          cfg: 7.0,
          sampler_name: "dpmpp_2m",
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

    // Default to anything if no key specified
    if (!modelKey) {
      modelKey = "anything";
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

    // Fallback to anything
    const anythingFilename = "AnythingXL_xl.safetensors";
    return {
      filename: anythingFilename,
      ...this.models.get(anythingFilename),
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

    // Check for quality flags first
    const qualityPatterns = {
      hq: /--(?:hq|quality|high-quality)/i,
      fast: /--(?:fast|quick|standard)/i,
    };

    let useHQ = false; // Default to fast mode for speed

    // Check for quality flags
    if (qualityPatterns.fast.test(commandText)) {
      useHQ = false;
    } else if (qualityPatterns.hq.test(commandText)) {
      useHQ = true;
    }

    // Always use Anything XL as the base model
    const selectedModel = "anything";
    const model = this.getModelByKey(selectedModel);

    // Override workflow based on quality setting
    if (!useHQ) {
      // Use fast workflows for standard Anything XL generation
      model.workflow = "anything.json";
      model.defaultSettings = {
        steps: 30,
        cfg: 7.0,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
      };
    } else {
      // Use high-quality workflows for --hq flag
      model.workflow = "anything.json";
      model.defaultSettings = {
        steps: 45,
        cfg: 7.0,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
      };
    }

    return model;
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
      sampler_name: model.defaultSettings.sampler_name,
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
