import config from "../../config/config.js";
import { getLogger } from "../logger.js";
import {
  PROVIDER_FALLBACK_ENABLED,
  PROVIDER_RETRY_ATTEMPTS,
  PROVIDER_RETRY_DELAY,
} from "./constants.js";
import { performanceMonitor } from "./performanceMonitor.js";

// TextDecoder is available globally in Node.js 18+, but we import it for clarity
const { TextDecoder } = globalThis;

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
   * @returns {Promise<Object>} Parsed JSON response
   */
  async makeApiRequest(url, options) {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

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
      progressCallback = null,
    } = options;

    // Determine which provider to use based on generation type
    let targetProvider = provider;

    if (!targetProvider) {
      // Route to appropriate provider based on type
      if (type === "image") {
        targetProvider = this.getImageProvider();
        if (!targetProvider) {
          throw new Error(
            "No image generation provider available. Please enable Stability AI, OpenAI, or OpenRouter in config.js and configure their API keys.",
          );
        }
      } else if (type === "text" || type === "chat") {
        targetProvider = this.getTextProvider();
        if (!targetProvider) {
          throw new Error(
            "No text/chat provider available. Please enable self-hosted (Ollama), OpenRouter, or OpenAI in config.js and configure their API keys if needed.",
          );
        }
      } else {
        // Fallback to primary provider for unknown types
        targetProvider = this.getPrimaryProvider();
        if (!targetProvider) {
          throw new Error(
            "AI features are disabled. All providers are disabled. Please enable at least one provider in config.js to use AI features.",
          );
        }
      }
    }

    const providerConfig = this.config.providers[targetProvider];

    if (!providerConfig) {
      throw new Error(`Unknown AI provider: ${targetProvider}`);
    }

    // Check if provider is enabled (only if explicitly forced)
    if (provider && providerConfig.enabled !== true) {
      throw new Error(
        `${providerConfig.name} is disabled. Please enable it in config or use a different provider.`,
      );
    }

    // API key is optional for self-hosted providers (e.g., Automatic1111)
    if (targetProvider !== "selfhosted" && !providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    const startTime = Date.now();
    let lastError = null;
    const attemptedProviders = new Set();

    // Try primary provider first, then fallback to others if enabled
    const providersToTry = [targetProvider];
    if (PROVIDER_FALLBACK_ENABLED && !provider) {
      // Add fallback providers in priority order
      if (type === "image") {
        const fallbacks = ["stability", "openai", "openrouter"];
        for (const fallback of fallbacks) {
          if (
            fallback !== targetProvider &&
            this.config.providers[fallback]?.enabled &&
            this.config.providers[fallback]?.apiKey
          ) {
            providersToTry.push(fallback);
          }
        }
      } else if (type === "text" || type === "chat") {
        const fallbacks = ["selfhosted", "openrouter", "openai"];
        for (const fallback of fallbacks) {
          if (
            fallback !== targetProvider &&
            this.config.providers[fallback]?.enabled
          ) {
            if (
              fallback === "selfhosted" ||
              this.config.providers[fallback]?.apiKey
            ) {
              providersToTry.push(fallback);
            }
          }
        }
      }
    }

    // Try each provider until one succeeds
    for (
      let attempt = 0;
      attempt < Math.min(providersToTry.length, PROVIDER_RETRY_ATTEMPTS + 1);
      attempt++
    ) {
      const currentProvider = providersToTry[attempt];
      const currentProviderConfig = this.config.providers[currentProvider];

      if (!currentProviderConfig || !currentProviderConfig.enabled) {
        continue;
      }

      if (currentProvider !== "selfhosted" && !currentProviderConfig.apiKey) {
        continue;
      }

      if (attemptedProviders.has(currentProvider)) {
        continue; // Already tried this provider
      }

      attemptedProviders.add(currentProvider);

      try {
        logger.debug(
          `Using ${currentProviderConfig.name} for ${type} generation${attempt > 0 ? ` (fallback attempt ${attempt})` : ""}`,
        );

        let result;

        if (type === "image") {
          result = await this.generateImage(
            prompt,
            genConfig,
            currentProvider,
            progressCallback,
          );
        } else if (type === "text" || type === "chat") {
          result = await this.generateText(prompt, genConfig, currentProvider);
        } else {
          throw new Error(
            `Unsupported generation type: ${type}. Supported types: 'image', 'text', 'chat'.`,
          );
        }

        const responseTime = Date.now() - startTime;

        // Record successful request
        performanceMonitor.recordRequest({
          provider: currentProvider,
          responseTime,
          success: true,
        });

        logger.info(
          `AI generation completed using ${currentProviderConfig.name} in ${responseTime}ms${attempt > 0 ? ` (after ${attempt} fallback attempt(s))` : ""}`,
        );
        return result;
      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - startTime;

        // Record failed request
        performanceMonitor.recordRequest({
          provider: currentProvider,
          responseTime,
          success: false,
          error: error.message,
        });

        logger.warn(
          `AI generation failed with ${currentProviderConfig.name}: ${error.message}${attempt < providersToTry.length - 1 ? " - trying fallback provider..." : ""}`,
        );

        // If there are more providers to try, wait before retrying
        if (attempt < providersToTry.length - 1) {
          await new Promise(resolve => {
            setTimeout(() => {
              resolve();
            }, PROVIDER_RETRY_DELAY);
          });
        }
      }
    }

    // All providers failed
    logger.error(
      `AI generation failed with all providers (${attemptedProviders.size} attempted)`,
    );
    throw lastError || new Error("All AI providers failed");
  }

  /**
   * Generate image using specified provider
   * @param {string} prompt - Image generation prompt
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, config, provider, progressCallback = null) {
    const providerConfig = this.config.providers[provider];
    const model = providerConfig.models.image.primary;

    if (progressCallback) {
      progressCallback("Initializing image generation...");
    }

    if (provider === "openrouter") {
      return this.generateImageOpenRouter(
        prompt,
        model,
        config,
        progressCallback,
      );
    } else if (provider === "openai") {
      return this.generateImageOpenAI(prompt, model, config, progressCallback);
    } else if (provider === "stability") {
      return this.generateImageStability(
        prompt,
        model,
        config,
        progressCallback,
      );
    } else if (provider === "selfhosted") {
      return this.generateImageSelfHosted(
        prompt,
        model,
        config,
        progressCallback,
      );
    } else {
      throw new Error(`Unsupported provider for image generation: ${provider}`);
    }
  }

  /**
   * Generate image using OpenRouter
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use
   * @param {Object} config - Generation configuration
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageOpenRouter(
    prompt,
    model,
    _config,
    progressCallback = null,
  ) {
    if (progressCallback) {
      progressCallback("Sending generation request...");
    }
    const requestBody = {
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    };

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
    );

    if (progressCallback) {
      progressCallback("Processing image response...");
    }

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

    if (progressCallback) {
      progressCallback("Downloading generated image...");
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

    const finalBuffer = Buffer.from(imageBuffer);

    // Validate image buffer size - content moderation blocks often return 2-byte placeholders
    if (finalBuffer.length < 1000) {
      logger.error(
        `OpenRouter returned suspiciously small image buffer: ${finalBuffer.length} bytes (likely content moderation block)`,
      );
      throw new Error(
        "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate. Try using a less explicit prompt.",
      );
    }

    return {
      imageBuffer: finalBuffer,
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
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageOpenAI(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback("Sending generation request...");
    }
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

    if (progressCallback) {
      progressCallback("Downloading generated image...");
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
   * @param {Buffer} config.imageBuffer - Optional: source image buffer for image-to-image
   * @param {number} config.strength - Optional: image-to-image strength (0.0-1.0, default 0.5)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageStability(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback("Preparing request for Stability AI...");
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

    if (progressCallback) {
      progressCallback("Generating image (this may take 30-60s)...");
    }

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

    if (progressCallback) {
      progressCallback("Processing generated image...");
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
   * Generate image using Self-Hosted Stable Diffusion (Automatic1111 WebUI)
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model name (not used, but kept for consistency)
   * @param {Object} config - Generation configuration
   * @param {Buffer} config.imageBuffer - Optional: source image buffer for image-to-image
   * @param {number} config.strength - Optional: image-to-image strength (0.0-1.0, default 0.5)
   * @returns {Promise<Object>} Generated image data
   */
  async generateImageSelfHosted(
    prompt,
    _model,
    config,
    progressCallback = null,
  ) {
    if (progressCallback) {
      progressCallback("Sending generation request...");
    }
    // Load prompt configuration
    const promptConfig = await loadPromptConfig();

    // Use provider-specific negative prompt
    const negativePrompt =
      promptConfig.PROVIDER_PROMPTS?.selfhosted?.negative ||
      promptConfig.NEGATIVE_PROMPT;

    // Parse aspect ratio (e.g., "16:9" -> width: 1024, height: 576)
    const aspectRatio = config.aspectRatio || "1:1";
    const [width, height] = this.parseAspectRatio(aspectRatio);

    // Build request body for Automatic1111 API
    const requestBody = {
      prompt,
      negative_prompt: negativePrompt,
      steps: config.steps || 20,
      width,
      height,
      cfg_scale: config.cfgScale || 7,
      sampler_name: config.samplerName || "Euler a",
      seed: config.seed !== undefined ? config.seed : -1, // -1 = random
    };

    // Image-to-image support
    if (config.imageBuffer) {
      // Convert buffer to base64
      const base64Image = config.imageBuffer.toString("base64");
      requestBody.init_images = [base64Image];
      requestBody.denoising_strength =
        config.strength !== undefined ? config.strength : 0.5;
    }

    if (progressCallback) {
      progressCallback("Generating image (this may take 30-60s)...");
    }

    // Build API URL
    const apiUrl = `${this.config.providers.selfhosted.baseUrl}/sdapi/v1/txt2img`;
    if (config.imageBuffer) {
      // Use img2img endpoint for image-to-image
      const img2imgUrl = `${this.config.providers.selfhosted.baseUrl}/sdapi/v1/img2img`;
      const response = await fetch(img2imgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.providers.selfhosted.apiKey && {
            Authorization: `Bearer ${this.config.providers.selfhosted.apiKey}`,
          }),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Self-hosted API error: ${response.status} - ${errorData}`,
        );
      }

      const data = await response.json();
      if (!data.images || data.images.length === 0) {
        throw new Error("No image generated in response");
      }

      if (progressCallback) {
        progressCallback("Processing generated image...");
      }

      // Decode base64 image
      const base64Image = data.images[0];
      const imageBuffer = Buffer.from(base64Image, "base64");
      const imageUrl = `data:image/png;base64,${base64Image}`;

      return {
        imageBuffer,
        imageUrl,
        model: _model,
        provider: "selfhosted",
        prompt,
      };
    }

    // Text-to-image request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.providers.selfhosted.apiKey && {
          Authorization: `Bearer ${this.config.providers.selfhosted.apiKey}`,
        }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Self-hosted API error: ${response.status} - ${errorData}`,
      );
    }

    const data = await response.json();
    if (!data.images || data.images.length === 0) {
      throw new Error("No image generated in response");
    }

    if (progressCallback) {
      progressCallback("Processing generated image...");
    }

    // Decode base64 image
    const base64Image = data.images[0];
    const imageBuffer = Buffer.from(base64Image, "base64");
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return {
      imageBuffer,
      imageUrl,
      model: _model,
      provider: "selfhosted",
      prompt,
    };
  }

  /**
   * Parse aspect ratio string to width and height
   * @param {string} aspectRatio - Aspect ratio string (e.g., "16:9", "1:1", "3:2")
   * @returns {[number, number]} [width, height]
   */
  parseAspectRatio(aspectRatio) {
    // Common aspect ratios mapped to 512/768/1024 base sizes
    const ratioMap = {
      "1:1": [512, 512],
      "16:9": [768, 432],
      "9:16": [432, 768],
      "4:3": [640, 480],
      "3:4": [480, 640],
      "3:2": [768, 512],
      "2:3": [512, 768],
      "21:9": [1024, 432],
    };

    if (ratioMap[aspectRatio]) {
      return ratioMap[aspectRatio];
    }

    // Parse custom ratio (e.g., "16:9")
    const parts = aspectRatio.split(":");
    if (parts.length === 2) {
      const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);
      // Use 512 as base, scale height based on ratio
      const width = 512;
      const height = Math.round(512 / ratio);
      return [width, height];
    }

    // Default to 1:1
    return [512, 512];
  }

  /**
   * Generate text/chat using specified provider
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {Object} config - Generation configuration
   * @param {string} provider - Provider to use
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, config, provider) {
    const providerConfig = this.config.providers[provider];
    const model = providerConfig.models?.text?.primary || config.model;

    if (provider === "selfhosted") {
      return this.generateTextSelfHosted(prompt, model, config);
    } else if (provider === "openrouter") {
      return this.generateTextOpenRouter(prompt, model, config);
    } else if (provider === "openai") {
      return this.generateTextOpenAI(prompt, model, config);
    } else {
      throw new Error(`Unsupported provider for text generation: ${provider}`);
    }
  }

  /**
   * Generate text using Self-Hosted AI (Ollama, etc.)
   * Supports OpenAI-compatible API
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextSelfHosted(prompt, model, config) {
    // Convert prompt to messages format if needed
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    // Add system message if provided
    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    // Build request body (OpenAI-compatible format)
    // Default to llama3.1:8b (minimum for structured JSON output)
    // Note: llama3.2 (3B) is too small for structured JSON output
    const requestBody = {
      model: model || "llama3.1:8b",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: false,
    };

    // Build API URL - try OpenAI-compatible endpoint first, fallback to Ollama native
    const baseUrl = this.config.providers.selfhosted.baseUrl;
    let apiUrl = `${baseUrl}/v1/chat/completions`;

    // If baseUrl ends with :11434 (Ollama default), try native API as fallback
    const isOllama = baseUrl.includes(":11434") || baseUrl.includes("ollama");

    // Try OpenAI-compatible endpoint first
    let response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.providers.selfhosted.apiKey && {
          Authorization: `Bearer ${this.config.providers.selfhosted.apiKey}`,
        }),
      },
      body: JSON.stringify(requestBody),
    });

    // If OpenAI-compatible fails and it's Ollama, try native API
    if (!response.ok && isOllama) {
      // Convert to Ollama native format
      const ollamaBody = {
        model: requestBody.model,
        messages,
        stream: false,
        options: {
          temperature: requestBody.temperature,
          num_predict: requestBody.max_tokens,
        },
      };

      apiUrl = `${baseUrl}/api/chat`;
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ollamaBody),
      });

      if (response.ok) {
        const ollamaData = await response.json();
        return {
          text: ollamaData.message?.content || ollamaData.response || "",
          model: ollamaData.model || model,
          provider: "selfhosted",
          usage: null,
        };
      }
    }

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Self-hosted API error: ${response.status} - ${errorData}`,
      );
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No text generated in response");
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Response missing content");
    }

    return {
      text: content,
      model: data.model || model,
      provider: "selfhosted",
      usage: data.usage || null,
    };
  }

  /**
   * Generate text using OpenRouter
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextOpenRouter(prompt, model, config) {
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    const requestBody = {
      model: model || "meta-llama/llama-3.2-3b-instruct:free",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
    };

    // Add response_format for structured output if supported by model
    // This helps enforce JSON format (OpenRouter supports this for compatible models)
    if (config.responseFormat === "json_object" || config.forceJson) {
      requestBody.response_format = { type: "json_object" };
    }

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
    );

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No text generated in response");
    }

    return {
      text: content,
      model: data.model || model,
      provider: "openrouter",
      usage: data.usage || null,
    };
  }

  /**
   * Generate text using OpenAI
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextOpenAI(prompt, model, config) {
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    const response = await fetch(
      `${this.config.providers.openai.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.providers.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "gpt-3.5-turbo",
          messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1000,
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

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No text generated in response");
    }

    return {
      text: content,
      model: data.model || model,
      provider: "openai",
      usage: data.usage || null,
    };
  }

  /**
   * Generate streaming AI text response
   * @param {Object} options - Configuration options
   * @param {string|Array} options.prompt - Input prompt (string or messages array)
   * @param {string} options.model - Model name
   * @param {Object} options.config - Additional configuration
   * @param {string} options.provider - Provider name
   * @param {Function} options.onChunk - Callback for each chunk (chunk: string) => void
   * @returns {Promise<Object>} Final response with full text
   */
  async generateTextStreaming(options) {
    const { prompt, model, config = {}, provider, onChunk } = options;

    if (!onChunk || typeof onChunk !== "function") {
      throw new Error("onChunk callback is required for streaming");
    }

    if (!provider) {
      throw new Error("Provider is required for streaming");
    }

    // Route to provider-specific streaming implementation
    switch (provider) {
      case "openrouter":
        return await this.generateTextStreamingOpenRouter(
          prompt,
          model,
          config,
          onChunk,
        );
      case "openai":
        return await this.generateTextStreamingOpenAI(
          prompt,
          model,
          config,
          onChunk,
        );
      case "selfhosted":
        return await this.generateTextStreamingSelfHosted(
          prompt,
          model,
          config,
          onChunk,
        );
      default:
        throw new Error(`Streaming not supported for provider: ${provider}`);
    }
  }

  /**
   * Generate streaming text using OpenRouter
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreamingOpenRouter(prompt, model, config, onChunk) {
    const providerConfig = this.config.providers.openrouter;
    if (!providerConfig?.enabled || !providerConfig?.apiKey) {
      throw new Error("OpenRouter is not enabled or API key is missing");
    }

    // Convert prompt to messages format
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    const requestBody = {
      model: model || providerConfig.models.text.primary,
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: true, // Enable streaming
    };

    if (config.responseFormat === "json_object" || config.forceJson) {
      requestBody.response_format = { type: "json_object" };
    }

    const headers = this.createHeaders(providerConfig.apiKey, "openrouter");

    // Use fetch with streaming
    const response = await fetch(providerConfig.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      );
    }

    // Process Server-Sent Events (SSE) stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta); // Call callback with chunk
              }
            } catch (_e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: fullText,
      model: model || providerConfig.models.text.primary,
      provider: "openrouter",
      usage: null, // Streaming doesn't provide usage in chunks
    };
  }

  /**
   * Generate streaming text using OpenAI
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreamingOpenAI(prompt, model, config, onChunk) {
    const providerConfig = this.config.providers.openai;
    if (!providerConfig?.enabled || !providerConfig?.apiKey) {
      throw new Error("OpenAI is not enabled or API key is missing");
    }

    // Convert prompt to messages format
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    const apiUrl = `${providerConfig.baseUrl}/chat/completions`;
    const requestBody = {
      model: model || "gpt-3.5-turbo",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: true, // Enable streaming
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      );
    }

    // Process Server-Sent Events (SSE) stream (same format as OpenRouter)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch (_e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: fullText,
      model: model || "gpt-3.5-turbo",
      provider: "openai",
      usage: null,
    };
  }

  /**
   * Generate streaming text using Self-Hosted (Ollama)
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreamingSelfHosted(prompt, model, config, onChunk) {
    const providerConfig = this.config.providers.selfhosted;
    const baseUrl = providerConfig.baseUrl;

    // Convert prompt to messages
    let messages = [];
    if (typeof prompt === "string") {
      messages = [{ role: "user", content: prompt }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else {
      throw new Error("Prompt must be a string or array of messages");
    }

    if (config.systemMessage) {
      messages.unshift({ role: "system", content: config.systemMessage });
    }

    // Try OpenAI-compatible endpoint first
    let apiUrl = `${baseUrl}/v1/chat/completions`;
    const isOllama = baseUrl.includes(":11434") || baseUrl.includes("ollama");

    const requestBody = {
      model: model || "llama3.1:8b",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: true,
    };

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(providerConfig.apiKey && {
          Authorization: `Bearer ${providerConfig.apiKey}`,
        }),
      },
      body: JSON.stringify(requestBody),
    });

    // If OpenAI-compatible fails and it's Ollama, try native API
    if (!response.ok && isOllama) {
      apiUrl = `${baseUrl}/api/chat`;
      const ollamaBody = {
        model: requestBody.model,
        messages,
        stream: true,
        options: {
          temperature: requestBody.temperature,
          num_predict: requestBody.max_tokens,
        },
      };

      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ollamaBody),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Self-hosted API error: ${response.status} - ${errorText}`,
      );
    }

    // Process stream (SSE format for OpenAI-compatible, JSON lines for Ollama native)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;

          // Try SSE format first (OpenAI-compatible)
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch (_e) {
              // Ignore parse errors
            }
          } else {
            // Try Ollama native format (JSON lines)
            try {
              const json = JSON.parse(line);
              const ollamaDelta = json.message?.content || json.response;
              if (ollamaDelta) {
                fullText += ollamaDelta;
                onChunk(ollamaDelta);
              }
            } catch (_e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: fullText,
      model: model || "llama3.1:8b",
      provider: "selfhosted",
      usage: null,
    };
  }

  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      primary: this.getPrimaryProvider(),
      providers: Object.keys(this.config.providers),
      enabledProviders: Object.entries(this.config.providers)
        .filter(([, provider]) => provider.enabled === true)
        .map(([key]) => key),
    };
  }
}

// Export singleton instance
export const multiProviderAIService = new MultiProviderAIService();
