import { AI_STATUS_MESSAGES } from "../statusMessages.js";

const fetch = globalThis.fetch;
const { TextDecoder } = globalThis;

/**
 * OpenAI AI Provider
 * Handles text generation, streaming, and image generation via OpenAI
 */
export class OpenAIProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Generate text using OpenAI
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
      model: model || "gpt-3.5-turbo",
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
      `[OPENAI API REQUEST] Model: ${requestBody.model} | Provider: openai`,
    );
    logger.info(
      `[OPENAI API REQUEST] Temperature: ${requestBody.temperature} | Max Tokens: ${requestBody.max_tokens}`,
    );
    logger.info(`[OPENAI API REQUEST] Messages Count: ${messages.length}`);
    logger.info("[OPENAI API REQUEST] Full Request Body:");
    logger.info(JSON.stringify(requestBody, null, 2));
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
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
   * Generate streaming text using OpenAI
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreaming(prompt, model, config, onChunk) {
    if (!this.config?.enabled || !this.config?.apiKey) {
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

    const apiUrl = `${this.config.baseUrl}/chat/completions`;
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
        Authorization: `Bearer ${this.config.apiKey}`,
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
   * Generate image using OpenAI DALL-E
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use (dall-e-3, dall-e-2)
   * @param {Object} config - Generation configuration
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.OPENAI_SENDING);
    }
    const response = await fetch(`${this.config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
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
    });

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
      progressCallback(AI_STATUS_MESSAGES.OPENAI_DOWNLOADING);
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
}
