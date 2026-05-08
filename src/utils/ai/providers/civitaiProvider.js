import { AI_STATUS_MESSAGES } from "../statusMessages.js";

const fetch = globalThis.fetch;

/**
 * Civitai Provider
 * Handles image generation via Civitai Orchestration API
 * Supports anime models with NSFW content
 */
export class CivitaiProvider {
  constructor(config) {
    this.config = config;
    this.baseUrl = "https://orchestration.civitai.com";
  }

  /**
   * Get auth headers for API requests
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Generate image using Civitai API
   * @param {string} prompt - Image generation prompt
   * @param {string} model - Model to use (e.g., "animagine-xl-4.0", "pony-diffusion-v6-xl")
   * @param {Object} config - Generation configuration
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.CIVITAI_PREPARING);
    }

    const width = config.width || 1024;
    const height = config.height || 1024;
    const steps = config.steps || 28;
    const cfgScale = config.cfgScale || 5;

    const negativePrompt =
      config.negativePrompt ||
      "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, bad_fingers, extra_fingers, mutated_fingers, mutated_hands, six_fingers";

    try {
      if (progressCallback) {
        progressCallback(AI_STATUS_MESSAGES.CIVITAI_SUBMITTING);
      }

      // Submit workflow
      const submitResponse = await fetch(`${this.baseUrl}/v1/workflows`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          workflow: {
            $type: "imageGen",
            input: {
              model,
              prompt,
              negativePrompt,
              width,
              height,
              steps,
              cfgScale,
              seed: config.seed || -1,
              scheduler: config.scheduler || "Euler",
            },
          },
        }),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(
          `Civitai API error: ${submitResponse.status} - ${errorText}`,
        );
      }

      const submitResult = await submitResponse.json();
      const workflowId = submitResult.id;

      if (progressCallback) {
        progressCallback(AI_STATUS_MESSAGES.CIVITAI_GENERATING);
      }

      // Poll for completion
      const maxAttempts = 120; // 2 minutes max (120 × 1 second)
      let attempts = 0;
      let workflowStatus = null;

      while (attempts < maxAttempts) {
        await this.sleep(1000);
        attempts++;

        const statusResponse = await fetch(
          `${this.baseUrl}/v1/workflows/${workflowId}`,
          {
            method: "GET",
            headers: this.getAuthHeaders(),
          },
        );

        if (!statusResponse.ok) {
          throw new Error(
            `Failed to get workflow status: ${statusResponse.status}`,
          );
        }

        const statusResult = await statusResponse.json();
        workflowStatus = statusResult;

        // Check if completed
        if (
          statusResult.status === "completed" ||
          statusResult.status === "failed"
        ) {
          break;
        }
      }

      if (!workflowStatus || workflowStatus.status !== "completed") {
        throw new Error(
          `Workflow did not complete. Status: ${
            workflowStatus?.status || "unknown"
          }`,
        );
      }

      // Get the generated image
      const output = workflowStatus.output;
      let imageUrl = null;

      // Handle different output formats
      if (typeof output === "string") {
        imageUrl = output;
      } else if (output?.url) {
        imageUrl = output.url;
      } else if (output?.imageUrl) {
        imageUrl = output.imageUrl;
      } else if (Array.isArray(output) && output.length > 0) {
        imageUrl = typeof output[0] === "string" ? output[0] : output[0]?.url;
      }

      if (!imageUrl) {
        throw new Error("No image URL in workflow output");
      }

      // Download the image
      if (progressCallback) {
        progressCallback(AI_STATUS_MESSAGES.CIVITAI_DOWNLOADING);
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      if (progressCallback) {
        progressCallback(AI_STATUS_MESSAGES.CIVITAI_COMPLETE);
      }

      return {
        imageBuffer: Buffer.from(imageBuffer),
        imageUrl,
        model,
        generationTime: attempts * 1000,
      };
    } catch (error) {
      throw new Error(`Civitai generation failed: ${error.message}`);
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Check API balance
   * @returns {Promise<Object>} Balance information
   */
  async checkBalance() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/balance`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Balance check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Balance check failed: ${error.message}`);
    }
  }
}
