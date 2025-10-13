import config from "../../config/config.js";
import { getLogger } from "../logger.js";

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../config/prompts.js");
  }
  return promptConfigCache;
}

const fetch = globalThis.fetch;
const logger = getLogger();

// Cache for repeated requests to avoid duplicate API calls
const requestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Multi-provider AI service supporting both OpenRouter and OpenAI
 */
export class MultiProviderAIService {
  constructor() {
    this.config = config.aiModels;
  }

  /**
   * Make an API request with error handling and caching
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @param {string} cacheKey - Cache key for request deduplication
   * @returns {Promise<Object>} Parsed JSON response
   */
  async makeApiRequest(url, options, cacheKey = null) {
    // Check cache first
    if (cacheKey && requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached.data;
      }
      requestCache.delete(cacheKey);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

    // Cache successful responses
    if (cacheKey) {
      requestCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }

    return data;
  }

  /**
   * Create common headers for API requests
   * @param {string} apiKey - API key for authentication
   * @param {string} provider - Provider name for custom headers
   * @returns {Object} Headers object
   */
  createHeaders(apiKey, provider = "openrouter") {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] =
        process.env.BOT_WEBSITE_URL || "https://rolereactor.app";
      headers["X-Title"] = process.env.BOT_NAME || "Role Reactor Bot";
    }

    return headers;
  }

  /**
   * Extract image URL from API response
   * @param {Object} data - API response data
   * @returns {string|null} Image URL or null if not found
   */
  extractImageUrl(data) {
    // Check for standard image generation response format
    if (data.choices?.[0]?.message?.images?.[0]) {
      const image = data.choices[0].message.images[0];
      return image.image_url?.url || image.url || image.data;
    }

    // Check for content-based image response
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      if (content.startsWith("data:image/")) {
        return content;
      }
      if (/^[A-Za-z0-9+/=]+$/.test(content)) {
        return `data:image/png;base64,${content}`;
      }
      if (content.startsWith("http://") || content.startsWith("https://")) {
        return content;
      }
    }

    // Check for parts-based response (Gemini format)
    const parts =
      data.choices?.[0]?.message?.content?.parts ||
      data.candidates?.[0]?.content?.parts;
    if (parts) {
      const imagePart = parts.find(part => part.inline_data || part.url);
      if (imagePart) {
        return imagePart.url || imagePart.inline_data?.data;
      }
    }

    // Check for direct image response
    if (data.images?.[0]) {
      return data.images[0].url || data.images[0].data;
    }

    return null;
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
    } = options;

    // Determine which provider to use
    const targetProvider = provider || this.config.primary;
    const providerConfig = this.config.providers[targetProvider];

    if (!providerConfig) {
      throw new Error(`Unknown AI provider: ${targetProvider}`);
    }

    if (!providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    try {
      logger.debug(`Using ${providerConfig.name} for ${type} generation`);

      const startTime = Date.now();
      let result;

      if (type === "image") {
        result = await this.generateImage(prompt, genConfig, targetProvider);
      } else {
        throw new Error(
          `Unsupported generation type: ${type}. Only 'image' is supported.`,
        );
      }

      const responseTime = Date.now() - startTime;

      logger.info(
        `AI generation completed using ${providerConfig.name} in ${responseTime}ms`,
      );
      return result;
    } catch (error) {
      logger.error(`AI generation failed with ${providerConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate image using specified provider
   * @param {string} prompt - Image generation prompt
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, config, provider) {
    const providerConfig = this.config.providers[provider];
    const model = providerConfig.models.image.primary;

    if (provider === "openrouter") {
      return this.generateImageOpenRouter(prompt, model, config);
    } else if (provider === "openai") {
      return this.generateImageOpenAI(prompt, model, config);
    } else if (provider === "stability") {
      return this.generateImageStability(prompt, model, config);
    } else {
      throw new Error(`Unsupported provider for image generation: ${provider}`);
    }
  }

  /**
   * Generate image using OpenRouter
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageOpenRouter(prompt, model, _config) {
    const requestBody = {
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    };

    const cacheKey = `openrouter_image_${model}_${Buffer.from(prompt).toString("base64").slice(0, 32)}`;

    const data = await this.makeApiRequest(
      this.config.providers.openrouter.baseUrl,
      {
        method: "POST",
        headers: this.createHeaders(
          this.config.providers.openrouter.apiKey,
          "openrouter",
        ),
        body: JSON.stringify(requestBody),
      },
      cacheKey,
    );

    logger.debug(
      "OpenRouter response structure:",
      JSON.stringify(data, null, 2),
    );

    const imageUrl = this.extractImageUrl(data);
    if (!imageUrl) {
      logger.error("OpenRouter response missing image data:", {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        firstChoice: data.choices?.[0],
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        hasImages: !!data.images,
        fullResponse: data,
      });
      throw new Error("No image generated in response");
    }

    // Handle different image URL formats
    let imageBuffer;
    if (imageUrl.startsWith("data:image/")) {
      // Base64 data URL
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (
      imageUrl.startsWith("data:") ||
      /^[A-Za-z0-9+/=]+$/.test(imageUrl)
    ) {
      // Raw base64 data
      imageBuffer = Buffer.from(imageUrl, "base64");
    } else {
      // URL - download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download generated image: ${imageResponse.statusText}`,
        );
      }
      imageBuffer = await imageResponse.arrayBuffer();
    }

    return {
      imageBuffer: Buffer.from(imageBuffer),
      imageUrl,
      model,
      provider: "openrouter",
      prompt,
    };
  }

  /**
   * Generate image using OpenAI DALL-E
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use (dall-e-3, dall-e-2)
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageOpenAI(prompt, model, config) {
    const response = await fetch(
      `${this.config.providers.openai.baseUrl}/images/generations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.providers.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: config.size || "1024x1024",
          quality: config.quality || "standard",
          style: config.style || "vivid",
          response_format: "url",
          user: "rolereactor-bot",
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.data || !data.data[0]?.url) {
      throw new Error("No image generated in response");
    }

    // Download and convert to buffer
    const imageUrl = data.data[0].url;
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download generated image: ${imageResponse.statusText}`,
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    return {
      imageBuffer: Buffer.from(imageBuffer),
      imageUrl,
      model,
      provider: "openai",
      prompt,
    };
  }

  /**
   * Generate image using Stability AI (Stable Diffusion 3.5)
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use (sd3.5-flash, sd3.5-medium, etc.)
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageStability(prompt, model, config) {
    // Load prompt configuration
    const promptConfig = await loadPromptConfig();

    // Create FormData for multipart/form-data request
    const formData = new globalThis.FormData();
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", "1:1");
    formData.append("style_preset", "anime"); // Perfect for anime avatars!
    formData.append("cfg_scale", config.cfgScale || 7); // Higher CFG for better prompt adherence
    formData.append("steps", config.steps || 20); // More steps for better quality
    formData.append("seed", config.seed || Math.floor(Math.random() * 1000000)); // Random seed for variety

    // Use negative prompt from configuration
    formData.append("negative_prompt", promptConfig.NEGATIVE_PROMPT);

    const response = await fetch(this.config.providers.stability.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.providers.stability.apiKey}`,
        Accept: "image/*",
        "Stability-Client-ID": "rolereactor-bot",
        "Stability-Client-Version": "1.0.0",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Stability AI API error: ${response.status} - ${errorData}`,
      );
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

  /**
   * Clear the request cache
   */
  clearCache() {
    requestCache.clear();
    logger.debug("Request cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, value] of requestCache.entries()) {
      if (now - value.timestamp < CACHE_TTL) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: requestCache.size,
      validEntries,
      expiredEntries,
      cacheTTL: CACHE_TTL,
    };
  }

  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      primary: this.config.primary,
      providers: Object.keys(this.config.providers),
    };
  }
}

// Export singleton instance
export const multiProviderAIService = new MultiProviderAIService();
