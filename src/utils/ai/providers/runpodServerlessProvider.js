import { parseAspectRatio } from "./providerUtils.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";
import { getLogger } from "../../logger.js";

const logger = getLogger();
const fetch = globalThis.fetch;

/**
 * RunPod Serverless Provider
 * Uses RunPod Serverless API for ComfyUI image generation
 * API Docs: https://docs.runpod.io/serverless/endpoints/send-requests
 */
export class RunPodServerlessProvider {
  constructor(config) {
    this.config = config || {};
    this.name = "RunPod Serverless";
    this.baseUrl = this.config.baseUrl || "";
    this.apiKey = this.config.apiKey || "";
    this.endpointId = this.config.endpointId || "";

    // Only validate if provider is enabled
    if (this.config.enabled && !this.endpointId) {
      logger.warn(
        "[RunPod Serverless] Endpoint ID is missing but provider is enabled",
      );
    }

    // Build API URL if endpoint ID exists
    if (this.endpointId) {
      this.apiUrl = `https://api.runpod.ai/v2/${this.endpointId}`;
      logger.info(
        `[RunPod Serverless] Initialized with endpoint: ${this.endpointId}`,
      );
    }
  }

  /**
   * Build ComfyUI workflow JSON
   * Uses the universal 2-stage workflow (base + refine)
   */
  buildWorkflow(
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    cfgScale,
    sampler,
    seed,
  ) {
    const actualSeed =
      seed === -1 ? Math.floor(Math.random() * 1000000000) : seed;

    // Calculate upscale dimensions (1.23x for faster generation)
    // 832 -> 1024 is optimal for speed while maintaining quality
    const upscaleWidth = Math.round(width * 1.23);
    const upscaleHeight = Math.round(height * 1.23);

    const workflow = {
      2: {
        inputs: {
          ckpt_name: this.config.checkpoint || "AnythingXL_xl.safetensors",
        },
        class_type: "CheckpointLoaderSimple",
      },
      3: {
        inputs: {
          text: prompt,
          clip: ["2", 1],
        },
        class_type: "CLIPTextEncode",
      },
      4: {
        inputs: {
          text: negativePrompt,
          clip: ["2", 1],
        },
        class_type: "CLIPTextEncode",
      },
      5: {
        inputs: {
          width,
          height,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
      },
      6: {
        inputs: {
          seed: actualSeed,
          steps,
          cfg: cfgScale,
          sampler_name: sampler,
          scheduler: "karras",
          denoise: 1.0,
          model: ["2", 0],
          positive: ["3", 0],
          negative: ["4", 0],
          latent_image: ["5", 0],
        },
        class_type: "KSampler",
      },
      8: {
        inputs: {
          upscale_method: "nearest-exact",
          width: upscaleWidth,
          height: upscaleHeight,
          crop: "disabled",
          samples: ["6", 0],
        },
        class_type: "LatentUpscale",
      },
      10: {
        inputs: {
          seed: actualSeed,
          steps: Math.round(steps * 0.6), // 15 steps for refinement (60% of base, faster)
          cfg: cfgScale,
          sampler_name: sampler,
          scheduler: "karras",
          denoise: 0.65, // Research-backed optimal denoise
          model: ["2", 0],
          positive: ["3", 0],
          negative: ["4", 0],
          latent_image: ["8", 0],
        },
        class_type: "KSampler",
      },
      12: {
        inputs: {
          samples: ["10", 0],
          vae: ["2", 2],
        },
        class_type: "VAEDecode",
      },
      13: {
        inputs: {
          filename_prefix: "ComfyUI_Universal",
          images: ["12", 0],
        },
        class_type: "SaveImage",
      },
    };

    return workflow;
  }

  /**
   * Submit job to RunPod Serverless (async)
   */
  async submitJob(workflow, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.COMFYUI_SENDING);
    }

    try {
      // Debug: Log node 10 to verify it has all required inputs
      if (workflow["10"]) {
        logger.debug(
          "[RunPod Serverless] Node 10 inputs:",
          JSON.stringify(workflow["10"].inputs),
        );
      }

      // RunPod Worker ComfyUI expects just the workflow object directly
      const response = await fetch(`${this.apiUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: {
            workflow,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `RunPod API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();

      if (!data.id) {
        throw new Error("No job ID returned from RunPod API");
      }

      logger.debug(`[RunPod Serverless] Job submitted: ${data.id}`);
      return data.id;
    } catch (error) {
      logger.error("[RunPod Serverless] Failed to submit job:", error);
      throw error;
    }
  }

  /**
   * Poll for job completion
   */
  async pollForCompletion(
    jobId,
    maxWaitTime = 300000,
    pollInterval = 2000,
    progressCallback = null,
  ) {
    const startTime = Date.now();
    let queueStartTime = null;

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.COMFYUI_QUEUED);
    }

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await fetch(`${this.apiUrl}/status/${jobId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data = await response.json();
        const currentStatus = data.status;
        logger.debug(
          `[RunPod Serverless] Job ${jobId} status: ${currentStatus}`,
        );

        if (currentStatus === "COMPLETED") {
          if (progressCallback) {
            progressCallback(AI_STATUS_MESSAGES.COMFYUI_PROCESSING);
          }
          return data;
        } else if (currentStatus === "FAILED") {
          throw new Error(`Job failed: ${data.error || "Unknown error"}`);
        } else if (currentStatus === "CANCELLED") {
          throw new Error("Job was cancelled");
        }

        // Track how long we've been in queue
        if (currentStatus === "IN_QUEUE") {
          if (!queueStartTime) {
            queueStartTime = Date.now();
          }
          const queueTime = Math.floor((Date.now() - queueStartTime) / 1000);

          // Update progress with cold start message after 10 seconds
          if (progressCallback && queueTime >= 10) {
            if (queueTime < 30) {
              progressCallback("⏳ Starting GPU worker (cold start)...");
            } else if (queueTime < 60) {
              progressCallback(`⏳ Loading models... (${queueTime}s)`);
            } else {
              progressCallback(
                `⏳ Still loading... (${queueTime}s) - Cold start may take up to 2 minutes`,
              );
            }
          }
        } else if (currentStatus === "IN_PROGRESS") {
          if (progressCallback) {
            progressCallback("🎨 Generating image...");
          }
        }

        await new Promise(resolve => {
          setTimeout(resolve, pollInterval);
        });
      } catch (error) {
        logger.error("[RunPod Serverless] Polling error:", error);
        throw error;
      }
    }

    throw new Error(`Job timed out after ${maxWaitTime}ms`);
  }

  /**
   * Extract image from job output
   */
  extractImage(jobData) {
    try {
      // RunPod returns output in data.output
      const output = jobData.output;

      if (!output) {
        throw new Error("No output in job data");
      }

      // RunPod Worker ComfyUI returns image URL in output.message
      if (output.message && typeof output.message === "string") {
        // Check if it's a URL (RunPod Worker format)
        if (
          output.message.startsWith("http://") ||
          output.message.startsWith("https://")
        ) {
          return output.message;
        }
        // Check if it's base64
        if (output.message.startsWith("data:image")) {
          return output.message;
        }
      }

      // Check for direct image URL (some ComfyUI handlers return this)
      if (output.image_url) {
        return output.image_url;
      }

      // Check for base64 image
      if (output.image) {
        return output.image;
      }

      // Check for images array (SaveImage node output)
      if (output.images && output.images.length > 0) {
        return output.images[0];
      }

      throw new Error("No image found in job output");
    } catch (error) {
      logger.error("[RunPod Serverless] Failed to extract image:", error);
      logger.debug(`Job data: ${JSON.stringify(jobData).substring(0, 500)}`);
      throw error;
    }
  }

  /**
   * Download image from URL or decode base64
   */
  async getImageBuffer(imageData) {
    try {
      // If it's a URL, download it
      if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
        logger.debug("[RunPod Serverless] Downloading image from URL");
        const response = await fetch(imageData);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      // If it's base64, decode it
      if (imageData.startsWith("data:image")) {
        logger.debug("[RunPod Serverless] Decoding base64 image");
        const base64Data = imageData.split(",")[1];
        return Buffer.from(base64Data, "base64");
      }

      // Assume it's raw base64
      logger.debug("[RunPod Serverless] Decoding raw base64");
      return Buffer.from(imageData, "base64");
    } catch (error) {
      logger.error("[RunPod Serverless] Failed to get image buffer:", error);
      throw error;
    }
  }

  /**
   * Generate image using RunPod Serverless
   */
  async generateImage(prompt, _model, config, progressCallback = null) {
    logger.info("[RunPod Serverless] Starting image generation");

    // Validate configuration
    if (!this.endpointId || !this.apiKey) {
      throw new Error(
        "RunPod Serverless is not properly configured. Please set RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY in your environment variables.",
      );
    }

    try {
      // Get negative prompt (use config or default)
      const negativePrompt =
        config.negativePrompt ||
        "bad anatomy, bad hands, bad fingers, missing fingers, extra fingers, fused fingers, too many fingers, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad proportions, extra limbs, missing limbs, bad feet, long neck, mutation, mutilated, out of frame, worst quality, low quality, jpeg artifacts, watermark, signature, username, text";

      // Parse aspect ratio
      const aspectRatio = config.aspectRatio || "1:1";
      const [width, height] = parseAspectRatio(aspectRatio);

      // Get seed
      const seedValue =
        config.seed !== undefined
          ? config.seed
          : Math.floor(Math.random() * 1000000000);

      // Build workflow
      const workflow = this.buildWorkflow(
        prompt,
        negativePrompt,
        width,
        height,
        config.steps || 30,
        config.cfgScale || 7,
        config.samplerName || "dpmpp_2m",
        seedValue,
      );

      // Submit job
      const jobId = await this.submitJob(workflow, progressCallback);

      // Poll for completion
      const jobData = await this.pollForCompletion(
        jobId,
        config.timeout || 300000,
        2000,
        progressCallback,
      );

      // Extract image
      const imageData = this.extractImage(jobData);

      // Get image buffer
      const imageBuffer = await this.getImageBuffer(imageData);

      logger.info("[RunPod Serverless] Image generation completed");

      return {
        imageBuffer,
        imageUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        seed: seedValue,
        model: this.config.checkpoint || "AnythingXL_xl.safetensors",
        provider: "runpod-serverless",
        metadata: {
          width: Math.round(width * 1.5), // Final upscaled size
          height: Math.round(height * 1.5),
          steps: config.steps || 30,
          cfgScale: config.cfgScale || 7,
          sampler: config.samplerName || "dpmpp_2m",
          executionTime: jobData.executionTime,
          delayTime: jobData.delayTime,
        },
      };
    } catch (error) {
      logger.error("[RunPod Serverless] Generation failed:", error);
      throw error;
    }
  }

  /**
   * Check health of RunPod endpoint
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return { healthy: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return {
        healthy: true,
        workers: data.workers,
        jobs: data.jobs,
      };
    } catch (error) {
      logger.error("[RunPod Serverless] Health check failed:", error);
      return { healthy: false, error: error.message };
    }
  }
}
