import { parseAspectRatio } from "./providerUtils.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";
import { getLogger } from "../../logger.js";

const logger = getLogger();
const fetch = globalThis.fetch;

// WebSocket support (optional - falls back to polling if not available)
// Lazy-loaded to avoid blocking if package is not installed
let WebSocketClient = null;
let wsChecked = false;

async function getWebSocketClient() {
  if (wsChecked) {
    return WebSocketClient;
  }
  wsChecked = true;
  try {
    // Try to import ws package (optional dependency)
    const wsModule = await import("ws");
    WebSocketClient = wsModule.default;
    logger.debug("[ComfyUI] WebSocket support enabled");
  } catch {
    // WebSocket not available, will use polling fallback
    logger.debug(
      "[ComfyUI] WebSocket package not available, using polling fallback",
    );
  }
  return WebSocketClient;
}

// Load prompt configuration with caching
let promptConfigCache = null;
async function loadPromptConfig() {
  if (!promptConfigCache) {
    promptConfigCache = await import("../../../config/prompts/index.js");
  }
  return promptConfigCache;
}

// Cache image prompts import (used frequently in generateImage)
let imagePromptsCache = null;
async function loadImagePrompts() {
  if (!imagePromptsCache) {
    imagePromptsCache = await import("../../../config/prompts/imagePrompts.js");
  }
  return imagePromptsCache;
}

/**
 * ComfyUI Provider
 * Handles image generation via ComfyUI/ComfyICU API
 * Supports queue-based workflow system
 */
export class ComfyUIProvider {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl?.replace(/\/$/, ""); // Remove trailing slash
    // Detect if using ComfyICU (has workflow_id) or standard ComfyUI
    this.isComfyICU =
      !!config.workflowId || this.baseUrl?.includes("comfy.icu");
  }

  /**
   * Build a ComfyUI workflow JSON with Hi-Res Fix for better quality
   * @param {string} prompt - Positive prompt
   * @param {string} negativePrompt - Negative prompt
   * @param {number} width - Target image width
   * @param {number} height - Target image height
   * @param {number} steps - Number of steps for base pass
   * @param {number} cfgScale - CFG scale
   * @param {string} sampler - Sampler name
   * @param {number} seed - Seed (-1 for random)
   * @param {boolean} useHiResFix - Enable Hi-Res Fix (default: true)
   * @returns {Object} ComfyUI workflow object
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
    useHiResFix = true,
  ) {
    // Get checkpoint name from config or use default
    const checkpointName =
      this.config.models?.image?.checkpoint ||
      "v1-5-pruned-emaonly.safetensors";

    // Generate actual seed if needed
    const actualSeed =
      seed === -1 ? Math.floor(Math.random() * 1000000000) : seed;

    // For Hi-Res Fix: start at lower resolution, then upscale
    const baseWidth = useHiResFix ? Math.round(width * 0.75) : width;
    const baseHeight = useHiResFix ? Math.round(height * 0.75) : height;

    if (!useHiResFix) {
      // Simple workflow without Hi-Res Fix
      const workflow = {
        1: {
          inputs: { ckpt_name: checkpointName },
          class_type: "CheckpointLoaderSimple",
        },
        2: {
          inputs: { text: prompt, clip: ["1", 1] },
          class_type: "CLIPTextEncode",
        },
        3: {
          inputs: { text: negativePrompt, clip: ["1", 1] },
          class_type: "CLIPTextEncode",
        },
        4: {
          inputs: { width, height, batch_size: 1 },
          class_type: "EmptyLatentImage",
        },
        5: {
          inputs: {
            seed: actualSeed,
            steps,
            cfg: cfgScale,
            sampler_name: sampler,
            scheduler: "karras",
            denoise: 1.0,
            model: ["1", 0],
            positive: ["2", 0],
            negative: ["3", 0],
            latent_image: ["4", 0],
          },
          class_type: "KSampler",
        },
        6: {
          inputs: { samples: ["5", 0], vae: ["1", 2] },
          class_type: "VAEDecode",
        },
        7: {
          inputs: { filename_prefix: "ComfyUI", images: ["6", 0] },
          class_type: "SaveImage",
        },
      };
      return { workflow };
    }

    // Hi-Res Fix workflow: Generate at base resolution, upscale, then refine
    const hiresSteps = Math.round(steps * 0.8); // Use 80% of base steps for refinement
    const hiresCfg = Math.max(cfgScale - 1, 7); // Reduce CFG by 1 for refinement pass
    const workflow = {
      1: {
        inputs: { ckpt_name: checkpointName },
        class_type: "CheckpointLoaderSimple",
      },
      2: {
        inputs: { text: prompt, clip: ["1", 1] },
        class_type: "CLIPTextEncode",
      },
      3: {
        inputs: { text: negativePrompt, clip: ["1", 1] },
        class_type: "CLIPTextEncode",
      },
      4: {
        inputs: { width: baseWidth, height: baseHeight, batch_size: 1 },
        class_type: "EmptyLatentImage",
      },
      5: {
        inputs: {
          seed: actualSeed,
          steps,
          cfg: cfgScale,
          sampler_name: sampler,
          scheduler: "karras",
          denoise: 1.0,
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["4", 0],
        },
        class_type: "KSampler",
      },
      6: {
        inputs: { samples: ["5", 0], vae: ["1", 2] },
        class_type: "VAEDecode",
      },
      // Upscale to target resolution
      8: {
        inputs: {
          upscale_method: "lanczos",
          width,
          height,
          crop: "center",
          image: ["6", 0],
        },
        class_type: "ImageScale",
      },
      // Encode back to latent
      9: {
        inputs: { pixels: ["8", 0], vae: ["1", 2] },
        class_type: "VAEEncode",
      },
      // Refine at high resolution with LOW denoise to preserve base
      10: {
        inputs: {
          seed: actualSeed,
          steps: hiresSteps,
          cfg: hiresCfg, // Reduced CFG to avoid artifacts
          sampler_name: sampler,
          scheduler: "karras",
          denoise: 0.35, // LOW denoise - only adds details, preserves base
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["9", 0],
        },
        class_type: "KSampler",
      },
      11: {
        inputs: { samples: ["10", 0], vae: ["1", 2] },
        class_type: "VAEDecode",
      },
      7: {
        inputs: { filename_prefix: "ComfyUI", images: ["11", 0] },
        class_type: "SaveImage",
      },
    };

    return { workflow };
  }

  /**
   * Submit a prompt to ComfyUI queue
   * @param {Object} workflow - Workflow object (contains workflow JSON)
   * @param {string} _prompt - Text prompt (unused, kept for compatibility)
   * @returns {Promise<string>} Prompt/Run ID
   */
  async submitPrompt(workflow, _prompt) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Add API key if provided (required for ComfyICU)
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    let url;
    let body;

    if (this.isComfyICU) {
      // ComfyICU API format - requires workflow_id AND prompt (workflow JSON)
      const workflowId = this.config.workflowId;
      if (!workflowId) {
        throw new Error(
          "The image generation service is not properly configured. This feature is temporarily unavailable.",
        );
      }
      if (!workflow || !workflow.workflow) {
        throw new Error(
          "The image generation service encountered an internal error. This feature is temporarily unavailable.",
        );
      }
      // Ensure base URL is comfy.icu (not api.comfy.icu)
      const apiBase = this.baseUrl.replace("api.comfy.icu", "comfy.icu");
      url = `${apiBase}/api/v1/workflows/${workflowId}/runs`;
      // ComfyICU expects: { workflow_id, prompt } where prompt is the ComfyUI workflow JSON
      body = JSON.stringify({
        workflow_id: workflowId,
        prompt: workflow.workflow, // Send the workflow JSON structure
      });
      logger.debug(`[ComfyUI] ComfyICU API URL: ${url}`);
      logger.debug(`[ComfyUI] ComfyICU Workflow ID: ${workflowId}`);
      logger.debug(
        `[ComfyUI] ComfyICU Request body keys: workflow_id, prompt (${Object.keys(workflow.workflow).length} nodes)`,
      );
    } else {
      // Standard ComfyUI API format
      // ComfyUI expects { "prompt": {...workflow nodes...} }
      url = `${this.baseUrl}/prompt`;
      body = JSON.stringify({
        prompt: workflow.workflow || workflow,
      });
      logger.debug(`[ComfyUI] Standard ComfyUI API URL: ${url}`);
      logger.debug(
        `[ComfyUI] Standard ComfyUI Request body keys: prompt (${Object.keys(workflow.workflow || workflow).length} nodes)`,
      );
    }

    logger.debug(`[ComfyUI] Making request to: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Connection: "keep-alive", // Reuse HTTP connections for better performance
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `[ComfyUI] API error: ${response.status} - ${errorText.substring(0, 200)}`,
      );
      throw new Error(
        "The image generation service encountered an error. Please try again later.",
      );
    }

    const data = await response.json();

    // ComfyICU returns 'id' field, standard ComfyUI returns prompt_id
    // Check for id first (ComfyICU), then run_id, then prompt_id (standard ComfyUI)
    const id = data.id || data.run_id || data.prompt_id;
    if (!id) {
      logger.error(
        `[ComfyUI] API did not return expected response: ${JSON.stringify(data).substring(0, 200)}`,
      );
      throw new Error(
        "The image generation service returned an unexpected response. Please try again later.",
      );
    }

    logger.debug(
      `[ComfyUI] Received ${this.isComfyICU ? "run" : "prompt"} ID: ${id}`,
    );
    return id;
  }

  /**
   * Delay helper function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  /**
   * Poll for workflow completion with WebSocket support for progress updates
   * @param {string} runId - Run/Prompt ID
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @param {number} pollInterval - Poll interval in milliseconds
   * @param {Function} progressCallback - Optional callback for progress updates (receives percentage)
   * @returns {Promise<Object>} History data with generated image info
   */
  async pollForCompletion(
    runId,
    maxWaitTime = 300000,
    pollInterval = 2000,
    progressCallback = null,
  ) {
    // DISABLED: WebSocket doesn't work reliably with RunPod proxy URLs
    // Always use HTTP polling for maximum compatibility
    const useWebSocket = false; // Set to true to enable WebSocket (only for direct ComfyUI)

    if (useWebSocket && !this.isComfyICU) {
      const wsClient = await getWebSocketClient();
      if (wsClient) {
        try {
          return await this.pollForCompletionWebSocket(
            runId,
            maxWaitTime,
            progressCallback,
          );
        } catch (error) {
          logger.debug(
            `[ComfyUI] WebSocket polling failed, falling back to HTTP: ${error.message}`,
          );
          // Fall through to HTTP polling
        }
      }
    }

    // HTTP polling (reliable for all ComfyUI setups)
    logger.debug(`[ComfyUI] Using HTTP polling for prompt: ${runId}`);
    return await this.pollForCompletionHTTP(
      runId,
      maxWaitTime,
      pollInterval,
      progressCallback,
    );
  }

  /**
   * Poll for workflow completion using WebSocket (real-time progress)
   * @param {string} runId - Run/Prompt ID
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} History data with generated image info
   */
  async pollForCompletionWebSocket(runId, maxWaitTime, progressCallback) {
    const wsClient = await getWebSocketClient();
    if (!wsClient) {
      throw new Error("WebSocket client not available");
    }

    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl
        .replace("http://", "ws://")
        .replace("https://", "wss://");
      const clientId = `role-reactor-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const ws = new wsClient(`${wsUrl}/ws?clientId=${clientId}`);

      let resolved = false;
      let progressReached100 = false;
      const cleanup = () => {
        if (!resolved && ws.readyState === ws.OPEN) {
          ws.close();
        }
      };

      const fetchFinalResult = async () => {
        if (resolved) return;
        logger.debug(`[ComfyUI] Fetching final result for prompt: ${runId}`);
        try {
          const historyData = await this.pollForCompletionHTTP(
            runId,
            10000, // Short timeout for final fetch
            500,
            null,
          );
          cleanup();
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(historyData);
          }
        } catch (error) {
          logger.error(
            `[ComfyUI] Failed to fetch final result: ${error.message}`,
          );
          cleanup();
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(
            new Error(
              "Image generation timed out. The process took too long to complete. Please try again with a simpler prompt.",
            ),
          );
        }
      }, maxWaitTime);

      ws.on("open", () => {
        logger.debug(`[ComfyUI] WebSocket connected, clientId: ${clientId}`);
        // Update status when WebSocket connects
        if (progressCallback) {
          progressCallback("Connected, waiting for generation to start...");
        }
        // ComfyUI WebSocket automatically sends updates for all prompts
        // No need to subscribe explicitly
      });

      ws.on("message", data => {
        try {
          // Skip binary data (preview images, etc.)
          // Check multiple ways since different WebSocket libs handle binary differently
          if (
            Buffer.isBuffer(data) ||
            data instanceof ArrayBuffer ||
            data instanceof Uint8Array
          ) {
            // ComfyUI sends binary preview images during generation
            // We don't need to process these, so skip silently
            return;
          }

          // Try to parse as string, skip if it fails (indicates binary data)
          let dataStr;
          try {
            dataStr = typeof data === "string" ? data : data.toString("utf8");
          } catch (_e) {
            // Failed to convert to string = binary data, skip
            return;
          }

          const message = JSON.parse(dataStr);

          // Log all message types for debugging
          logger.debug(
            `[ComfyUI] WebSocket message type: ${message.type}, data: ${JSON.stringify(message.data || {}).substring(0, 200)}`,
          );

          // Filter messages for our specific prompt_id ONLY if prompt_id is present
          // IMPORTANT: Many messages (progress, executing with node=null) don't have prompt_id!
          // We must process messages without prompt_id, assuming they're for our job
          const messagePromptId = message.data?.prompt_id || message.prompt_id;
          if (messagePromptId && messagePromptId !== runId) {
            // Has prompt_id but it's not ours - skip it
            logger.debug(
              `[ComfyUI] Skipping message for different prompt: ${messagePromptId}`,
            );
            return;
          }
          // If no prompt_id, we assume it's for our job (common for progress and completion messages)

          // Log only important messages for our prompt (reduced logging overhead)
          if (
            message.type === "execution_start" ||
            message.type === "execution_error"
          ) {
            logger.debug(
              `[ComfyUI] WebSocket message: type=${message.type}, prompt_id=${messagePromptId || "none"}`,
            );
          }

          // Handle progress updates
          if (message.type === "progress") {
            const { value, max } = message.data || {};
            if (value !== undefined && max !== undefined && max > 0) {
              const percentage = Math.round((value / max) * 100);
              logger.debug(
                `[ComfyUI] Progress: ${value}/${max} (${percentage}%)`,
              );
              if (progressCallback) {
                progressCallback(
                  `Generating image... ${percentage}% (${value}/${max} steps)`,
                );
              }

              // If we reach 100%, wait a bit then fetch the result
              if (percentage >= 100 && !progressReached100) {
                progressReached100 = true;
                logger.debug(
                  `[ComfyUI] Progress reached 100%, will fetch final result in 2 seconds...`,
                );
                setTimeout(() => {
                  fetchFinalResult();
                }, 2000); // Wait 2 seconds for ComfyUI to save the image
              }
            }
          }

          // Handle execution start
          if (message.type === "execution_start") {
            const promptId = message.data?.prompt_id;
            // If we already filtered by prompt_id above, this must be for our job
            if (!promptId || promptId === runId) {
              logger.debug(
                `[ComfyUI] Execution started, prompt_id=${promptId || "none"}`,
              );
              if (progressCallback) {
                progressCallback("Generating image... 0% (0 steps)");
              }
            }
          }

          // Handle execution complete (node is null when execution finishes)
          if (message.type === "executing") {
            const promptId = message.data?.prompt_id;
            // CRITICAL: node=null message often doesn't have prompt_id!
            // If we already filtered by prompt_id above, this must be for our job
            if (message.data?.node === null) {
              // Node is null when execution is complete
              logger.debug(
                `[ComfyUI] Execution completed (executing message with node=null), prompt_id=${promptId || "none"}`,
              );
              // Fetch final result via HTTP
              setTimeout(() => {
                fetchFinalResult();
              }, 2000); // Wait 2 seconds for ComfyUI to save the image
            }
          }

          // Handle execution error
          if (message.type === "execution_error") {
            const promptId = message.data?.prompt_id;
            // If we already filtered by prompt_id above, this must be for our job
            if (!promptId || promptId === runId) {
              const errorMsg = JSON.stringify(
                message.data?.exception_message ||
                  message.data?.error ||
                  "Unknown error",
              );
              logger.error(
                `[ComfyUI] Execution error for prompt_id=${promptId || "none"}: ${errorMsg}`,
              );
              cleanup();
              clearTimeout(timeout);
              if (!resolved) {
                resolved = true;
                reject(
                  new Error(
                    "Image generation failed. The workflow encountered an error. Please try a different prompt or try again later.",
                  ),
                );
              }
            }
          }
        } catch (error) {
          logger.debug(
            `[ComfyUI] WebSocket message parse error: ${error.message}`,
          );
        }
      });

      ws.on("error", error => {
        logger.debug(`[ComfyUI] WebSocket error: ${error.message}`);
        cleanup();
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      ws.on("close", () => {
        logger.debug(`[ComfyUI] WebSocket closed`);
        cleanup();
      });
    });
  }

  /**
   * Poll for workflow completion using HTTP (fallback)
   * @param {string} runId - Run/Prompt ID
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @param {number} pollInterval - Poll interval in milliseconds
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} History data with generated image info
   */
  async pollForCompletionHTTP(
    runId,
    maxWaitTime = 300000,
    pollInterval = 2000,
    progressCallback = null,
  ) {
    const startTime = Date.now();

    const headers = {
      Accept: "application/json",
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    let pollCount = 0;
    while (Date.now() - startTime < maxWaitTime) {
      pollCount++;
      // Update progress every few polls (not every poll to avoid spam)
      if (progressCallback) {
        if (pollCount === 1) {
          // First poll - show that we're checking status
          progressCallback("Checking generation status...");
        } else if (pollCount % 5 === 0) {
          // Every 5 polls - show elapsed time
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          progressCallback(`Generating image... (${elapsed}s elapsed)`);
        }
      }

      let url;
      if (this.isComfyICU) {
        // ComfyICU API format - requires workflow_id in path
        // Format: /api/v1/workflows/{workflow_id}/runs/{run_id}
        const workflowId = this.config.workflowId;
        if (!workflowId) {
          throw new Error(
            "The image generation service is not properly configured. This feature is temporarily unavailable.",
          );
        }
        const apiBase = this.baseUrl.replace("api.comfy.icu", "comfy.icu");
        url = `${apiBase}/api/v1/workflows/${workflowId}/runs/${runId}`;
      } else {
        // Standard ComfyUI API format
        url = `${this.baseUrl}/history/${runId}`;
      }

      const response = await fetch(url, {
        headers: {
          ...headers,
          Connection: "keep-alive", // Reuse HTTP connections
        },
      });

      if (!response.ok) {
        // If 404, workflow might still be queued
        if (response.status === 404) {
          await this.delay(pollInterval);
          continue;
        }
        const errorText = await response.text();
        logger.error(
          `[ComfyUI] API error: ${response.status} - ${errorText.substring(0, 200)}`,
        );
        throw new Error(
          "The image generation service encountered an error. Please try again later.",
        );
      }

      const data = await response.json();

      if (this.isComfyICU) {
        // ComfyICU response format - status can be "COMPLETED", "ERROR", "PENDING", "RUNNING", "INIT", "QUEUED"
        logger.debug(`[ComfyUI] ComfyICU status: ${data.status}`);

        // Log full response for debugging when status changes
        if (
          data.status === "ERROR" ||
          data.status === "FAILED" ||
          data.status === "COMPLETED"
        ) {
          logger.debug(
            `[ComfyUI] ComfyICU full response: ${JSON.stringify(data, null, 2)}`,
          );
        }

        if (data.status === "COMPLETED") {
          return data;
        }
        if (data.status === "ERROR" || data.status === "FAILED") {
          // Extract error message from various possible fields
          let errorMsg = null;

          // Try to get detailed error message from output.error
          if (data.output?.error) {
            const errorObj = data.output.error;
            if (errorObj.exception_message) {
              errorMsg = errorObj.exception_message;
            } else if (errorObj.message) {
              errorMsg = errorObj.message;
            } else if (errorObj.details?.error?.message) {
              errorMsg = errorObj.details.error.message;
              // Add node errors if available
              if (errorObj.details?.node_errors) {
                const nodeErrors = Object.entries(errorObj.details.node_errors)
                  .map(([nodeId, nodeError]) => {
                    const errors = nodeError.errors || [];
                    return `Node ${nodeId} (${nodeError.class_type}): ${errors.map(e => e.message || e.details).join(", ")}`;
                  })
                  .join("; ");
                if (nodeErrors) {
                  errorMsg += ` - ${nodeErrors}`;
                }
              }
            }
          }

          // Fallback to other error fields
          if (!errorMsg) {
            errorMsg =
              data.error ||
              data.message ||
              data.error_message ||
              data.errorMessage ||
              data.reason ||
              data.traceback ||
              (typeof data.output === "string" ? data.output : null) ||
              "Unknown error";
          }

          // Log technical details for debugging, but show user-friendly message
          logger.error(`[ComfyUI] ComfyICU workflow error: ${errorMsg}`);
          throw new Error(
            "Image generation failed. The workflow encountered an error. Please try a different prompt or try again later.",
          );
        }
        // Status is "PENDING", "RUNNING", "INIT", "QUEUED", continue polling
      } else {
        // Standard ComfyUI response format
        if (data[runId] && data[runId].status?.completed) {
          return data[runId];
        }
        if (data[runId] && data[runId].status?.error) {
          const errorMsg = data[runId].status.error;
          logger.error(`[ComfyUI] Workflow error: ${errorMsg}`);
          throw new Error(
            "Image generation failed. The workflow encountered an error. Please try a different prompt or try again later.",
          );
        }
      }

      // Wait before next poll
      await this.delay(pollInterval);
    }

    throw new Error(
      "Image generation timed out. The process took too long to complete. Please try again with a simpler prompt.",
    );
  }

  /**
   * Get image filename or URL from workflow output
   * @param {Object} historyData - History data from pollForCompletion
   * @returns {string|null} Image filename or URL
   */
  getImageFilename(historyData) {
    if (this.isComfyICU) {
      // Log the full response structure for debugging
      logger.debug(
        `[ComfyUI] ComfyICU output structure: ${JSON.stringify(historyData).substring(0, 1000)}...`,
      );
      // ComfyICU returns output files - check various possible formats
      // Files saved to /output/ directory are returned as output
      if (historyData.output) {
        // Check for output files array
        if (
          Array.isArray(historyData.output) &&
          historyData.output.length > 0
        ) {
          const firstFile = historyData.output[0];
          if (typeof firstFile === "string") {
            return firstFile; // Direct URL or path
          }
          if (firstFile.url) {
            return firstFile.url;
          }
          if (firstFile.path) {
            return firstFile.path;
          }
        }
        // Check for output object with files
        if (
          historyData.output.files &&
          Array.isArray(historyData.output.files)
        ) {
          const firstFile = historyData.output.files[0];
          return typeof firstFile === "string"
            ? firstFile
            : firstFile.url || firstFile.path;
        }
        // Check for direct URL fields
        if (historyData.output.image_url) {
          return historyData.output.image_url;
        }
        if (historyData.output.url) {
          return historyData.output.url;
        }
      }
      // Check top-level fields
      if (historyData.image_url) {
        return historyData.image_url;
      }
      if (historyData.url) {
        return historyData.url;
      }
      if (
        historyData.files &&
        Array.isArray(historyData.files) &&
        historyData.files.length > 0
      ) {
        const firstFile = historyData.files[0];
        return typeof firstFile === "string"
          ? firstFile
          : firstFile.url || firstFile.path;
      }
    } else {
      // Standard ComfyUI format
      if (!historyData?.outputs) {
        return null;
      }

      // Find SaveImage node output
      for (const nodeId in historyData.outputs) {
        const nodeOutput = historyData.outputs[nodeId];
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          return nodeOutput.images[0].filename;
        }
      }
    }

    return null;
  }

  /**
   * Download generated image
   * @param {string} filenameOrUrl - Image filename or URL
   * @returns {Promise<Buffer>} Image buffer
   */
  async downloadImage(filenameOrUrl) {
    let url;

    if (this.isComfyICU) {
      // ComfyICU returns full URL
      if (
        filenameOrUrl.startsWith("http://") ||
        filenameOrUrl.startsWith("https://")
      ) {
        url = filenameOrUrl;
      } else {
        // Fallback to view endpoint - ensure base URL is comfy.icu
        const apiBase = this.baseUrl.replace("api.comfy.icu", "comfy.icu");
        url = `${apiBase}/api/v1/images/${filenameOrUrl}`;
      }
    } else {
      // Standard ComfyUI uses view endpoint
      url = `${this.baseUrl}/view?filename=${encodeURIComponent(filenameOrUrl)}`;
    }

    const headers = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      logger.error(
        `[ComfyUI] Failed to download image: ${response.status} - ${response.statusText}`,
      );
      throw new Error(
        "Failed to retrieve the generated image. Please try generating again.",
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate image using ComfyUI
   * @param {string} prompt - Image generation prompt
   * @param {string} _model - Model name (not used, workflow uses checkpoint)
   * @param {Object} config - Generation configuration
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, _model, config, progressCallback = null) {
    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.COMFYUI_SENDING);
    }

    // Use avatar prompts only if explicitly requested (for /avatar command)
    // For /imagine command, use imagine-specific negative prompt
    let negativePrompt;
    if (config.useAvatarPrompts !== false) {
      // Default to true for backward compatibility (avatar command)
      const promptConfig = await loadPromptConfig();
      negativePrompt =
        promptConfig.PROVIDER_PROMPTS?.comfyui?.negative ||
        promptConfig.PROVIDER_PROMPTS?.selfhosted?.negative ||
        promptConfig.NEGATIVE_PROMPT ||
        "text, watermark, low quality, blurry";
    } else {
      // Use imagine-specific negative prompt for better quality (cached import)
      const imagePrompts = await loadImagePrompts();
      negativePrompt =
        imagePrompts.IMAGINE_PROVIDER_NEGATIVE_PROMPTS?.comfyui ||
        imagePrompts.IMAGINE_NEGATIVE_PROMPT ||
        "text, watermark, low quality, blurry";
    }

    // Parse aspect ratio (default to 1:1 for versatility)
    const aspectRatio = config.aspectRatio || "1:1";
    const [width, height] = parseAspectRatio(aspectRatio);

    // Store seed for return (use provided seed or generate random)
    const seedValue =
      config.seed !== undefined
        ? config.seed
        : Math.floor(Math.random() * 1000000000);

    // Always build workflow JSON (both ComfyICU and standard ComfyUI need it)
    // Optimized defaults for better quality and anatomy
    const workflow = this.buildWorkflow(
      prompt,
      negativePrompt,
      width,
      height,
      config.steps || 25, // Optimized: 25 base steps (will use ~15 more for hi-res fix)
      config.cfgScale || 8, // Increased to 8 for better prompt adherence and anatomy
      config.samplerName || "dpmpp_2m", // Better sampler: faster and more accurate than euler_ancestral
      seedValue === -1 ? Math.floor(Math.random() * 1000000000) : seedValue,
      config.useHiResFix === true, // Disable Hi-Res Fix by default (requires ImageScale node in ComfyUI)
    );

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.COMFYUI_GENERATING);
    }

    // Submit workflow (ComfyICU needs workflow_id + prompt JSON, standard ComfyUI needs just workflow)
    const runId = await this.submitPrompt(workflow, prompt);
    logger.debug(
      `[ComfyUI] Submitted ${this.isComfyICU ? "run" : "prompt"} with ID: ${runId}`,
    );

    if (progressCallback) {
      if (this.isComfyICU) {
        // ComfyICU uses HTTP polling, show queued status
        progressCallback(AI_STATUS_MESSAGES.COMFYUI_QUEUED);
      } else {
        // Standard ComfyUI uses WebSocket, show connecting status
        progressCallback("Connecting...");
      }
    }

    // Poll for completion with progress callback
    const historyData = await this.pollForCompletion(
      runId,
      300000,
      2000,
      progressCallback,
    );

    if (progressCallback) {
      progressCallback(AI_STATUS_MESSAGES.COMFYUI_PROCESSING);
    }

    // Get image filename
    const filename = this.getImageFilename(historyData);
    if (!filename) {
      logger.error(
        `[ComfyUI] No image found in workflow output: ${JSON.stringify(historyData).substring(0, 500)}`,
      );
      throw new Error(
        "Image generation completed but no image was found. Please try again.",
      );
    }

    // Download image
    const imageBuffer = await this.downloadImage(filename);
    const imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    return {
      imageBuffer,
      imageUrl,
      model: _model || "comfyui",
      provider: "comfyui",
      prompt,
      seed: seedValue, // Return seed for upscaling
    };
  }
}
