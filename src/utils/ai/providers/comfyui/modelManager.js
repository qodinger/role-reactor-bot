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
        workflow: "animagine-fast.json", // Use fast workflow by default
        description: "High-quality anime model with superior character knowledge",
        defaultSettings: {
          steps: 20,        // Reduced for speed
          cfg: 5.0,         // Optimized for speed
          sampler: "dpmpp_2m", // Faster sampler
          scheduler: "karras",
        },
      },

      // Anything XL - Uncensored anime model
      "AnythingXL_xl.safetensors": {
        name: "Anything XL",
        key: "anything",
        workflow: "anything-fast.json", // Use fast workflow by default
        description: "Uncensored anime model with versatile style",
        defaultSettings: {
          steps: 15,        // Reduced for speed
          cfg: 6.0,         // Optimized for speed
          sampler: "dpmpp_2m", // Faster sampler
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

    // Check for model flags
    const modelPatterns = {
      animagine: /--(?:model|m)\s+animagine|--animagine/i,
      anything: /--(?:model|m)\s+anything|--anything/i,
    };

    let selectedModel = "anything"; // Default model
    let useHQ = false; // Default to fast mode for speed

    // Check for specific model flags
    if (modelPatterns.animagine.test(commandText)) {
      selectedModel = "animagine";
    } else if (modelPatterns.anything.test(commandText)) {
      selectedModel = "anything";
    }

    // Check for quality flags
    if (qualityPatterns.fast.test(commandText)) {
      useHQ = false;
    } else if (qualityPatterns.hq.test(commandText)) {
      useHQ = true;
    }

    // Get the appropriate model configuration
    const modelKey = useHQ ? selectedModel : selectedModel;
    const model = this.getModelByKey(modelKey);

    // Override workflow based on quality setting
    if (!useHQ) {
      // Use fast workflows for standard generation
      if (selectedModel === "animagine") {
        model.workflow = "animagine-fast.json";
        model.defaultSettings = {
          steps: 20,
          cfg: 5.0,
          sampler: "dpmpp_2m",
          scheduler: "karras",
        };
      } else {
        model.workflow = "anything-fast.json";
        model.defaultSettings = {
          steps: 15,
          cfg: 6.0,
          sampler: "dpmpp_2m",
          scheduler: "karras",
        };
      }
    } else {
      // Use high-quality workflows for --hq flag
      if (selectedModel === "animagine") {
        model.workflow = "animagine-quality.json";
        model.defaultSettings = {
          steps: 35,
          cfg: 6.0,
          sampler: "dpmpp_2m_sde",
          scheduler: "karras",
        };
      } else {
        model.workflow = "anything-quality.json";
        model.defaultSettings = {
          steps: 30,
          cfg: 7.5,
          sampler: "dpmpp_2m_sde",
          scheduler: "karras",
        };
      }
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
