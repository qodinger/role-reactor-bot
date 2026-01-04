import { getLogger } from "../../logger.js";
import {
  makeApiRequest,
  createHeaders,
  extractImageUrl,
} from "./providerUtils.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";

const logger = getLogger();
const fetch = globalThis.fetch;
const { TextDecoder } = globalThis;

/**
 * OpenRouter AI Provider
 * Handles text generation, streaming, and image generation via OpenRouter
 */
export class OpenRouterProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Generate text using OpenRouter
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, model, config) {
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

    // ============================================================================
    // LOG FULL REQUEST BEING SENT TO API
    // ============================================================================
    const { getLogger } = await import("../../logger.js");
    const logger = getLogger();
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(
      `[OPENROUTER API REQUEST] Model: ${requestBody.model} | Provider: openrouter`,
    );
    logger.info(
      `[OPENROUTER API REQUEST] Temperature: ${requestBody.temperature} | Max Tokens: ${requestBody.max_tokens}`,
    );
    logger.info(`[OPENROUTER API REQUEST] Messages Count: ${messages.length}`);
    logger.info("[OPENROUTER API REQUEST] Full Request Body:");
    logger.info(JSON.stringify(requestBody, null, 2));
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Model-specific optimizations for speed
    // DeepSeek R1 is a reasoning model (inherently slower), but we can optimize parameters
    if (model && model.includes("deepseek-r1")) {
      // Lower temperature for faster, more deterministic responses
      requestBody.temperature = config.temperature || 0.5;
      // Reduce max_tokens to limit output length (faster generation)
      if (config.maxTokens && config.maxTokens > 1500) {
        requestBody.max_tokens = 1500; // Cap at 1500 for speed
      }
    }

    // Add response_format for structured output if supported by model
    // This helps enforce JSON format (OpenRouter supports this for compatible models)
    if (config.responseFormat === "json_object" || config.forceJson) {
      requestBody.response_format = { type: "json_object" };
    }

    const data = await makeApiRequest(this.config.baseUrl, {
      method: "POST",
      headers: createHeaders(this.config.apiKey, "openrouter"),
      body: JSON.stringify(requestBody),
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(
        "The AI service did not generate a response. Please try again.",
      );
    }

    return {
      text: content,
      model: data.model || model,
      provider: "openrouter",
      usage: data.usage || null,
    };
  }

  /**
   * Generate streaming text using OpenRouter
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreaming(prompt, model, config, onChunk) {
    if (!this.config?.enabled || !this.config?.apiKey) {
      throw new Error(
        "The AI service is not properly configured. This feature is temporarily unavailable.",
      );
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
      model: model || "meta-llama/llama-3.2-3b-instruct:free",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: true, // Enable streaming
    };

    // ============================================================================
    // LOG FULL REQUEST BEING SENT TO API (STREAMING)
    // ============================================================================
    const { getLogger } = await import("../../logger.js");
    const logger = getLogger();
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(
      `[OPENROUTER STREAMING REQUEST] Model: ${requestBody.model} | Provider: openrouter`,
    );
    logger.info(
      `[OPENROUTER STREAMING REQUEST] Temperature: ${requestBody.temperature} | Max Tokens: ${requestBody.max_tokens}`,
    );
    logger.info(
      `[OPENROUTER STREAMING REQUEST] Messages Count: ${messages.length}`,
    );
    logger.info("[OPENROUTER STREAMING REQUEST] Full Request Body:");
    logger.info(JSON.stringify(requestBody, null, 2));
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Model-specific optimizations for speed
    // DeepSeek R1 is a reasoning model (inherently slower), but we can optimize parameters
    if (requestBody.model && requestBody.model.includes("deepseek-r1")) {
      // Lower temperature for faster, more deterministic responses
      requestBody.temperature = config.temperature || 0.5;
      // Reduce max_tokens to limit output length (faster generation)
      if (requestBody.max_tokens > 1500) {
        requestBody.max_tokens = 1500; // Cap at 1500 for speed
      }
    }

    if (config.responseFormat === "json_object" || config.forceJson) {
      requestBody.response_format = { type: "json_object" };
    }

    const headers = createHeaders(this.config.apiKey, "openrouter");

    // Use fetch with streaming
    const response = await fetch(this.config.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { getLogger } = await import("../../logger.js");
      const logger = getLogger();
      logger.error(
        `[OpenRouter] Streaming API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      );

      // Parse error response for better user messages
      let errorMessage =
        "The AI chat service encountered an error. Please try again later.";

      if (
        response.status === 402 ||
        (errorData.error?.message &&
          errorData.error.message.includes("credits"))
      ) {
        errorMessage =
          "The AI chat service has run out of credits. This bot's service provider needs to add more credits to continue offering AI chat.";
      } else if (response.status === 400 && errorData.error?.message) {
        if (errorData.error.message.includes("model")) {
          errorMessage =
            "The requested AI model is not available. Please try again later.";
        } else if (
          errorData.error.message.includes("prompt") ||
          errorData.error.message.includes("content")
        ) {
          errorMessage =
            "Your message contains content that cannot be processed. Please try a different message.";
        } else {
          errorMessage =
            "Your request could not be processed. Please check your message and try again.";
        }
      } else if (response.status === 429) {
        errorMessage =
          "The AI service is currently busy. Please wait a moment and try again.";
      } else if (response.status === 401) {
        errorMessage =
          "The AI service authentication failed. The bot's service provider needs to fix the API configuration.";
      } else if (response.status >= 500) {
        errorMessage =
          "The AI service is temporarily unavailable. Please try again in a few minutes.";
      }

      throw new Error(errorMessage);
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
      model: model || "meta-llama/llama-3.2-3b-instruct:free",
      provider: "openrouter",
      usage: null, // Streaming doesn't provide usage in chunks
    };
  }

  /**
   * Generate image using OpenRouter
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use
   * @param {Object} config - Generation configuration
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.OPENROUTER_SENDING);
    }
    const requestBody = {
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    };

    const data = await makeApiRequest(this.config.baseUrl, {
      method: "POST",
      headers: createHeaders(this.config.apiKey, "openrouter"),
      body: JSON.stringify(requestBody),
    });

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.OPENROUTER_PROCESSING);
    }

    const imageUrl = extractImageUrl(data);
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
      progressCallback(AI_STATUS_MESSAGES.OPENROUTER_DOWNLOADING);
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

    // Validate image buffer size - removed content moderation check
    if (finalBuffer.length < 100) {
      logger.error(
        `OpenRouter returned suspiciously small image buffer: ${finalBuffer.length} bytes (likely error response)`,
      );
      throw new Error(
        "The AI provider returned an invalid image. Please try again.",
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
}
