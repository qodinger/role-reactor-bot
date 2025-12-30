import { parseAspectRatio } from "./providerUtils.js";

const fetch = globalThis.fetch;
const { TextDecoder } = globalThis;

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../../config/prompts.js");
  }
  return promptConfigCache;
}

/**
 * Self-Hosted AI Provider
 * Handles text generation, streaming, and image generation via self-hosted services (Ollama, Automatic1111)
 */
export class SelfHostedProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Generate text using Self-Hosted (Ollama)
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, model, config) {
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
    const requestBody = {
      model: model || "llama3.1:8b",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      stream: false,
    };

    // Build API URL - try OpenAI-compatible endpoint first, fallback to Ollama native
    const baseUrl = this.config.baseUrl;
    let apiUrl = `${baseUrl}/v1/chat/completions`;

    // If baseUrl ends with :11434 (Ollama default), try native API as fallback
    const isOllama = baseUrl.includes(":11434") || baseUrl.includes("ollama");

    // Try OpenAI-compatible endpoint first
    let response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
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
   * Generate streaming text using Self-Hosted (Ollama)
   * @param {string|Array} prompt - Text prompt or messages array
   * @param {string} model - Model name
   * @param {Object} config - Generation configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} Generated text data
   */
  async generateTextStreaming(prompt, model, config, onChunk) {
    const baseUrl = this.config.baseUrl;

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
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
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
   * Generate image using Self-Hosted Stable Diffusion (Automatic1111 WebUI)
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model name (not used, but kept for consistency)
   * @param {Object} config - Generation configuration
   * @param {Buffer} config.imageBuffer - Optional: source image buffer for image-to-image
   * @param {number} config.strength - Optional: image-to-image strength (0.0-1.0, default 0.5)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, _model, config, progressCallback = null) {
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
    const [width, height] = parseAspectRatio(aspectRatio);

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
    const apiUrl = `${this.config.baseUrl}/sdapi/v1/txt2img`;
    if (config.imageBuffer) {
      // Use img2img endpoint for image-to-image
      const img2imgUrl = `${this.config.baseUrl}/sdapi/v1/img2img`;
      const response = await fetch(img2imgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
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
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
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
}
