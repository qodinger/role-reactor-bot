import config from "../../config/config.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Generic AI service for various AI tasks
 */
export class AIService {
  constructor() {
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.botName = process.env.BOT_NAME || config.externalLinks.name;
    this.websiteUrl =
      process.env.BOT_WEBSITE_URL || config.externalLinks.github;
  }

  /**
   * Generate AI content (text, images, etc.)
   * @param {Object} options - Configuration options
   * @param {string} options.model - AI model to use
   * @param {string} options.prompt - Input prompt
   * @param {string} options.type - Type of generation (text, image, etc.)
   * @param {Object} options.config - Additional configuration
   * @returns {Promise<Object>} Generated content
   */
  async generate(options) {
    const { model, prompt, type = "text", config = {} } = options;

    if (!this.apiKey) {
      throw new Error(
        "OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment variables.",
      );
    }

    try {
      // eslint-disable-next-line no-undef
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.websiteUrl,
          "X-Title": this.botName,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          ...this.getTypeSpecificConfig(type, config),
        }),
      });

      if (!response.ok) {
        throw this.handleAPIError(response);
      }

      const result = await response.json();
      return this.processResponse(result, type);
    } catch (error) {
      logger.error(`AI generation failed (${type}):`, error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * Generate AI images
   * @param {string} prompt - Image generation prompt
   * @param {Object} config - Image configuration
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, config = {}) {
    const defaultConfig = {
      model: "google/gemini-2.5-flash-image-preview",
      aspect_ratio: "1:1",
      size: "1024x1024",
      quality: "standard",
    };

    const imageConfig = { ...defaultConfig, ...config };

    const result = await this.generate({
      model: imageConfig.model,
      prompt,
      type: "image",
      config: imageConfig,
    });

    return result;
  }

  /**
   * Generate AI text
   * @param {string} prompt - Text generation prompt
   * @param {Object} config - Text configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, config = {}) {
    const defaultConfig = {
      model: "google/gemini-2.5-flash",
      max_tokens: 1000,
      temperature: 0.7,
    };

    const textConfig = { ...defaultConfig, ...config };

    const result = await this.generate({
      model: textConfig.model,
      prompt,
      type: "text",
      config: textConfig,
    });

    return result;
  }

  /**
   * Get type-specific configuration for API calls
   * @param {string} type - Type of generation
   * @param {Object} config - Additional configuration
   * @returns {Object} API configuration
   */
  getTypeSpecificConfig(type, config) {
    switch (type) {
      case "image":
        return {
          modalities: ["image"],
          image_config: {
            aspect_ratio: config.aspect_ratio || "1:1",
            size: config.size || "1024x1024",
            quality: config.quality || "standard",
          },
        };
      case "text":
        return {
          max_tokens: config.max_tokens || 1000,
          temperature: config.temperature || 0.7,
        };
      default:
        return {};
    }
  }

  /**
   * Process API response based on type
   * @param {Object} result - API response
   * @param {string} type - Type of generation
   * @returns {Object} Processed result
   */
  processResponse(result, type) {
    switch (type) {
      case "image":
        if (!result.choices || !result.choices[0]?.message?.images) {
          logger.error("No images in response structure:", {
            hasChoices: !!result.choices,
            choicesLength: result.choices?.length,
            hasMessage: !!result.choices?.[0]?.message,
            hasImages: !!result.choices?.[0]?.message?.images,
          });
          throw new Error("No images generated in response");
        }
        logger.debug(
          `Successfully processed image response with ${result.choices[0].message.images.length} image(s)`,
        );
        return this.processImageResponse(result);
      case "text":
        if (!result.choices || !result.choices[0]?.message?.content) {
          throw new Error("No text generated in response");
        }
        logger.debug(
          `Successfully processed text response with ${result.choices[0].message.content.length} characters`,
        );
        return this.processTextResponse(result);
      default:
        return result;
    }
  }

  /**
   * Process image generation response
   * @param {Object} result - API response
   * @returns {Object} Processed image data
   */
  processImageResponse(result) {
    const imageData = result.choices[0].message.images[0];
    const imageUrl = imageData.image_url.url;

    // Convert base64 data URL to buffer
    const base64Data = imageUrl.split(",")[1];
    const imageBuffer = Buffer.from(base64Data, "base64");

    logger.debug(
      `Image processed: ${imageBuffer.length} bytes, format: ${imageData.image_url.url.split(";")[0]}`,
    );

    return {
      imageBuffer,
      imageUrl,
      prompt: result.choices[0].message.content || "Generated image",
    };
  }

  /**
   * Process text generation response
   * @param {Object} result - API response
   * @returns {Object} Processed text data
   */
  processTextResponse(result) {
    const text = result.choices[0].message.content;
    logger.debug(
      `Text processed: ${text.length} characters, tokens used: ${result.usage?.total_tokens || "unknown"}`,
    );

    return {
      text,
      usage: result.usage,
    };
  }

  /**
   * Handle API errors
   * @param {Response} response - HTTP response
   * @throws {Error} Specific error message
   */
  handleAPIError(response) {
    if (response.status === 402) {
      return new Error(
        "AI service is temporarily unavailable due to payment requirements. Please contact an administrator or try again later.",
      );
    } else if (response.status === 401) {
      return new Error(
        "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY environment variable.",
      );
    } else if (response.status === 429) {
      return new Error(
        "Rate limit exceeded. Please wait a few minutes before generating more content.",
      );
    } else {
      return new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Get available models for different tasks
   * @returns {Object} Available models by category
   */
  getAvailableModels() {
    return {
      image: ["google/gemini-2.5-flash-image-preview"],
      text: [
        "google/gemini-2.5-flash",
        "openai/gpt-4o",
        "anthropic/claude-3.5-sonnet",
      ],
      multimodal: [
        "google/gemini-2.5-flash",
        "openai/gpt-4o",
        "anthropic/claude-3.5-sonnet",
      ],
    };
  }
}

export const aiService = new AIService();
export const generateImage = (prompt, config) =>
  aiService.generateImage(prompt, config);
export const generateText = (prompt, config) =>
  aiService.generateText(prompt, config);
export const generate = options => aiService.generate(options);
