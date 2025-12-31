import { AI_STATUS_MESSAGES } from "../statusMessages.js";

const fetch = globalThis.fetch;

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../../config/prompts/index.js");
  }
  return promptConfigCache;
}

/**
 * Stability AI Provider
 * Handles image generation via Stability AI (Stable Diffusion 3.5)
 */
export class StabilityProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Generate image using Stability AI (Stable Diffusion 3.5)
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use (sd3.5-flash, sd3.5-medium, etc.)
   * @param {Object} config - Generation configuration
   * @param {Buffer} config.imageBuffer - Optional: source image buffer for image-to-image
   * @param {number} config.strength - Optional: image-to-image strength (0.0-1.0, default 0.5)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.STABILITY_PREPARING);
    }
    // Load prompt configuration
    const promptConfig = await loadPromptConfig();

    // Create FormData for multipart/form-data request
    const formData = new globalThis.FormData();
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("output_format", "png");

    // Image-to-image support: add source image if provided
    if (config.imageBuffer) {
      // FormData can accept Buffer directly in Node.js environments
      formData.append("image", config.imageBuffer, "source.png");
      // Strength controls how much the source image influences the result
      // 0.0 = ignore source, 1.0 = stay very close to source
      const strength = config.strength !== undefined ? config.strength : 0.5;
      formData.append("strength", strength.toString());
    }

    // Use aspect ratio from config if provided, otherwise default to 1:1
    const aspectRatio = config.aspectRatio || "1:1";
    formData.append("aspect_ratio", aspectRatio);

    // Only use anime style preset for avatar generation, not for general imagine
    if (config.style_preset) {
      formData.append("style_preset", config.style_preset);
    }

    formData.append("cfg_scale", config.cfgScale || 7); // Higher CFG for better prompt adherence
    formData.append("steps", config.steps || 20); // More steps for better quality
    formData.append("seed", config.seed || Math.floor(Math.random() * 1000000)); // Random seed for variety

    // Safety tolerance: 6 = most permissive, lower values (1-5) are more restrictive
    formData.append(
      "safety_tolerance",
      (config.safetyTolerance || 6).toString(),
    );

    // Use provider-specific negative prompt
    const negativePrompt =
      promptConfig.PROVIDER_PROMPTS?.stability?.negative ||
      promptConfig.NEGATIVE_PROMPT;
    formData.append("negative_prompt", negativePrompt);

    // ============================================================================
    // LOG FULL REQUEST BEING SENT TO API
    // ============================================================================
    const { getLogger } = await import("../../logger.js");
    const logger = getLogger();
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(
      `[STABILITY API REQUEST] Model: ${model} | Provider: stability`,
    );
    logger.info(
      `[STABILITY API REQUEST] Prompt (${prompt.length} chars): "${prompt}"`,
    );
    logger.info(
      `[STABILITY API REQUEST] Negative Prompt (${negativePrompt.length} chars): "${negativePrompt}"`,
    );
    logger.info(
      `[STABILITY API REQUEST] Config: CFG Scale: ${config.cfgScale || 7}, Steps: ${config.steps || 20}, Safety Tolerance: ${config.safetyTolerance || 6}`,
    );
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.STABILITY_GENERATING);
    }

    const response = await fetch(this.config.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: "image/*",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Stability AI API error: ${response.status} - ${errorData}`,
      );
    }

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.STABILITY_PROCESSING);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageUrl = `data:image/png;base64,${Buffer.from(imageBuffer).toString("base64")}`;

    return {
      imageBuffer: Buffer.from(imageBuffer),
      imageUrl,
      model,
      provider: "stability",
      prompt,
    };
  }
}
