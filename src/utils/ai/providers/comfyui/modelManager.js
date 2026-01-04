/**
 * ComfyUI Model Manager
 * Handles model selection, configuration, and flag-based routing
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

    // Model configurations with flags for easy selection
    const modelConfigs = {
      // Anime/Manga Style Models
      "AnythingXL_xl.safetensors": {
        name: "Anything XL",
        type: "anime",
        style: "anime",
        nsfw: true,
        quality: "high",
        speed: "medium",
        flags: ["anime", "manga", "2d", "stylized", "nsfw"],
        description: "High-quality anime/manga style model",
        defaultSettings: {
          steps: 25,
          cfg: 8,
          sampler: "dpmpp_2m",
        },
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
        defaultSettings: {
          steps: 30,
          cfg: 9,
          sampler: "dpmpp_2m_karras",
        },
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
        defaultSettings: {
          steps: 25,
          cfg: 7.5,
          sampler: "dpmpp_2m",
        },
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
        defaultSettings: {
          steps: 20,
          cfg: 7,
          sampler: "euler_a",
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
   * Get available models with optional filtering by flags
   */
  getAvailableModels(flags = []) {
    this.initialize();

    if (flags.length === 0) {
      return Array.from(this.models.entries()).map(([filename, config]) => ({
        filename,
        ...config,
      }));
    }

    return Array.from(this.models.entries())
      .filter(([, config]) =>
        flags.some(flag => config.flags.includes(flag.toLowerCase())),
      )
      .map(([filename, config]) => ({
        filename,
        ...config,
      }));
  }

  /**
   * Get model by flags (returns best match)
   */
  getModelByFlags(flags = []) {
    this.initialize();

    const availableModels = this.getAvailableModels(flags);

    if (availableModels.length === 0) {
      // Return default model
      return {
        filename: "AnythingXL_xl.safetensors",
        ...this.models.get("AnythingXL_xl.safetensors"),
      };
    }

    // Score models based on flag matches
    const scoredModels = availableModels.map(model => {
      const score = flags.reduce((acc, flag) => {
        return acc + (model.flags.includes(flag.toLowerCase()) ? 1 : 0);
      }, 0);
      return { ...model, score };
    });

    // Return highest scoring model
    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0];
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
   * Get model recommendations based on prompt content
   */
  getModelRecommendations(prompt) {
    this.initialize();

    const promptLower = prompt.toLowerCase();
    const recommendations = [];

    // Analyze prompt for style indicators
    const styleIndicators = {
      anime: [
        "anime",
        "manga",
        "2d",
        "kawaii",
        "chibi",
        "waifu",
        "girl",
        "boy",
      ],
      realistic: ["realistic", "photo", "portrait", "human", "person", "real"],
      furry: ["furry", "anthro", "wolf", "fox", "cat", "dog", "pony", "dragon"],
      artistic: [
        "art",
        "painting",
        "drawing",
        "sketch",
        "creative",
        "abstract",
      ],
    };

    for (const [style, indicators] of Object.entries(styleIndicators)) {
      const matches = indicators.filter(indicator =>
        promptLower.includes(indicator),
      );
      if (matches.length > 0) {
        const models = this.getAvailableModels([style]);
        recommendations.push({
          style,
          confidence: matches.length / indicators.length,
          matches,
          models,
        });
      }
    }

    // Sort by confidence
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return recommendations;
  }

  /**
   * Parse command flags and return model selection
   */
  parseModelFlags(commandText) {
    this.initialize();

    const flags = [];
    const flagPatterns = {
      // Style flags
      anime: /--anime|--manga|--2d/i,
      realistic: /--realistic|--photorealistic|--3d/i,
      furry: /--furry|--anthropomorphic|--pony/i,
      artistic: /--artistic|--creative/i,

      // Model specific flags
      anything: /--anything/i,
      realism: /--realism/i,
      pony: /--pony/i,
      deliberate: /--deliberate/i,
    };

    // Check for style flags
    if (flagPatterns.anime.test(commandText)) flags.push("anime");
    if (flagPatterns.realistic.test(commandText)) flags.push("realistic");
    if (flagPatterns.furry.test(commandText)) flags.push("furry");
    if (flagPatterns.artistic.test(commandText)) flags.push("artistic");

    // Check for specific model flags and return exact model
    if (flagPatterns.anything.test(commandText)) {
      return this.getModelByFilename("AnythingXL_xl.safetensors");
    }
    if (flagPatterns.realism.test(commandText)) {
      return this.getModelByFilename("realismEngineSDXL_v30VAE.safetensors");
    }
    if (flagPatterns.pony.test(commandText)) {
      return this.getModelByFilename(
        "ponyDiffusionV6XL_v6StartWithThisOne.safetensors",
      );
    }
    if (flagPatterns.deliberate.test(commandText)) {
      return this.getModelByFilename("deliberate_v2.safetensors");
    }

    // Return best match based on flags
    return this.getModelByFlags(flags);
  }

  /**
   * Get model statistics
   */
  getModelStats() {
    this.initialize();

    const stats = {
      total: this.models.size,
      byType: {},
      bySpeed: {},
      byQuality: {},
    };

    for (const model of this.models.values()) {
      // Count by type
      stats.byType[model.type] = (stats.byType[model.type] || 0) + 1;

      // Count by speed
      stats.bySpeed[model.speed] = (stats.bySpeed[model.speed] || 0) + 1;

      // Count by quality
      stats.byQuality[model.quality] =
        (stats.byQuality[model.quality] || 0) + 1;
    }

    return stats;
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

    // Check required fields
    const requiredFields = ["name", "type", "style", "flags", "description"];
    for (const field of requiredFields) {
      if (!model[field]) {
        return {
          valid: false,
          error: `Model '${filename}' missing required field: ${field}`,
        };
      }
    }

    // Check flags array
    if (!Array.isArray(model.flags) || model.flags.length === 0) {
      return {
        valid: false,
        error: `Model '${filename}' must have at least one flag`,
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
