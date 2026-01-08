/**
 * ComfyUI Provider for AI Image Generation - Phase 2 Enhanced
 * Supports both local ComfyUI and RunPod Serverless deployments
 * Uses specialized managers for better organization and maintainability
 * Updated: January 4, 2026
 */

import { getLogger } from "../../logger.js";
import { performanceMonitor } from "../performanceMonitor.js";
import { modelManager } from "./comfyui/modelManager.js";
import { workflowManager } from "./comfyui/workflowManager.js";
import { deploymentManager } from "./comfyui/deploymentManager.js";
import { configManager } from "./comfyui/configManager.js";
import WebSocket from "ws";

const fetch = globalThis.fetch;
const logger = getLogger();

export class ComfyUIProvider {
  constructor(config) {
    this.config = config;
    this.name = "ComfyUI";
    this.baseUrl = config.baseUrl || "http://127.0.0.1:8188";
    this.isRunPod = config.isRunPod || false;
    this.runPodConfig = config.runPod || {};
    this.initialized = false;

    // Initialize managers
    this.initializeManagers();
  }

  /**
   * Initialize specialized managers
   */
  async initializeManagers() {
    if (this.initialized) return;

    try {
      // Initialize configuration manager
      const aiConfig = {
        providers: {
          comfyui: this.config,
        },
      };

      // Only add runpod if it's actually a runpod deployment
      if (this.isRunPod && this.runPodConfig) {
        aiConfig.providers.runpod = this.config;
      }

      await configManager.loadConfig(aiConfig);

      // Initialize deployment manager
      deploymentManager.initialize(aiConfig);

      // Initialize model manager
      modelManager.initialize();

      // Initialize workflow manager
      await workflowManager.initialize();

      this.initialized = true;
      logger.info(`[ComfyUI] Managers initialized successfully`);
    } catch (error) {
      logger.error(`[ComfyUI] Failed to initialize managers:`, error);
      throw error;
    }
  }

  /**
   * Get available models with optional filtering by flags
   */
  getAvailableModels(flags = []) {
    return modelManager.getAvailableModels(flags);
  }

  /**
   * Get model by flags (returns best match)
   */
  getModelByFlags(flags = []) {
    return modelManager.getModelByFlags(flags);
  }

  /**
   * Get available workflows
   */
  async getAvailableWorkflows() {
    return await workflowManager.getAvailableWorkflows();
  }

  /**
   * Generate image using ComfyUI with enhanced deployment management
   */
  async generateImage(prompt, model, config = {}, progressCallback = null) {
    await this.initializeManagers();

    const startTime = Date.now();

    try {
      // Parse options from config
      const {
        steps = null,
        cfg = null,
        width = 1024,
        height = 1024,
        seed = null,
        negativePrompt = "",
        model: modelKey = null,
        preferRunPod = false,
      } = config;

      // Select model based on model key or default to animagine
      let selectedModel;
      if (modelKey) {
        selectedModel = modelManager.getModelByKey(modelKey);
      } else {
        // Default to animagine (best quality)
        selectedModel = modelManager.getModelByKey("animagine");
      }

      logger.info(
        `[ComfyUI] Using model: ${selectedModel.filename} (${selectedModel.key})`,
      );

      // Get optimal settings for the selected model
      const optimalSettings = modelManager.getOptimalSettings(
        selectedModel.key,
        steps,
        cfg,
      );

      // Get best deployment
      const deployment = await deploymentManager.getBestDeployment({
        preferRunPod,
        requireRealtime: !!progressCallback,
      });

      logger.info(`[ComfyUI] Using deployment: ${deployment.name}`);

      // Use the model's workflow
      const workflowName = selectedModel.workflow.replace('.json', '');
      
      // Get workflow with parameters
      const workflowWithParams =
        await workflowManager.getWorkflowWithParameters(workflowName, {
          model: selectedModel.filename,
          prompt,
          negativePrompt,
          steps: optimalSettings.steps,
          cfg: optimalSettings.cfg,
          width,
          height,
          seed,
        });

      // Generate based on deployment type
      if (deployment.type === "runpod") {
        return await this.generateWithRunPod(
          workflowWithParams.data,
          config,
          progressCallback,
        );
      } else {
        return await this.generateWithLocalComfyUI(
          workflowWithParams.data,
          config,
          progressCallback,
        );
      }
    } catch (error) {
      logger.error(`[ComfyUI] Generation failed:`, error);
      performanceMonitor.recordRequest({
        provider: "comfyui",
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate with local ComfyUI instance
   */
  async generateWithLocalComfyUI(workflowData, config, progressCallback) {
    const clientId = this.generateClientId();

    // Connect to WebSocket for progress updates
    let ws = null;
    if (progressCallback) {
      try {
        ws = new WebSocket(
          `${this.baseUrl.replace("http", "ws")}/ws?clientId=${clientId}`,
        );
        this.setupWebSocketHandlers(ws, progressCallback);
      } catch (error) {
        logger.warn(`[ComfyUI] WebSocket connection failed:`, error);
      }
    }

    try {
      // Submit workflow
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: workflowData,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ComfyUI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(`ComfyUI workflow error: ${result.error}`);
      }

      const promptId = result.prompt_id;
      logger.info(`[ComfyUI] Workflow submitted with prompt_id: ${promptId}`);

      // Wait for completion
      await this.waitForCompletion(promptId);

      // Get results
      const images = await this.getGenerationResults(promptId);

      // Close WebSocket
      if (ws) {
        ws.close();
      }

      // Return in format expected by existing bot structure
      if (images.length > 0) {
        return {
          imageBuffer: images[0].data,
          imageUrl: `data:image/png;base64,${images[0].data.toString("base64")}`,
          model: this.extractModelFromWorkflow(workflowData),
          provider: "comfyui",
          prompt: workflowData["6"]?.inputs?.text || "Generated image",
        };
      } else {
        throw new Error("No images generated");
      }
    } catch (error) {
      if (ws) ws.close();
      throw error;
    }
  }

  /**
   * Generate with RunPod Serverless
   */
  async generateWithRunPod(workflowData, _config, _progressCallback) {
    if (!this.runPodConfig.apiKey || !this.runPodConfig.endpointId) {
      throw new Error("RunPod API key and endpoint ID are required");
    }

    try {
      // Submit to RunPod
      const response = await fetch(
        `https://api.runpod.ai/v2/${this.runPodConfig.endpointId}/runsync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.runPodConfig.apiKey}`,
          },
          body: JSON.stringify({
            input: {
              workflow: workflowData,
              return_images: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.status === "FAILED") {
        throw new Error(`RunPod execution failed: ${result.error}`);
      }

      // Process RunPod response
      const images = result.output?.images || [];

      if (images.length > 0) {
        const imageData = images[0].data || images[0].image;
        return {
          imageBuffer: Buffer.from(imageData, "base64"),
          imageUrl: `data:image/png;base64,${imageData}`,
          model: this.extractModelFromWorkflow(workflowData),
          provider: "comfyui-runpod",
          prompt: workflowData["6"]?.inputs?.text || "Generated image",
        };
      } else {
        throw new Error("No images generated");
      }
    } catch (error) {
      logger.error(`[ComfyUI] RunPod generation failed:`, error);
      throw error;
    }
  }

  /**
   * Setup WebSocket handlers for progress updates
   */
  setupWebSocketHandlers(ws, progressCallback) {
    ws.on("message", data => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "progress":
            if (progressCallback) {
              const { value, max } = message.data;
              const percentage = Math.round((value / max) * 100);
              progressCallback(`Generating... ${percentage}%`);
            }
            break;

          case "executing":
            if (progressCallback) {
              progressCallback(`Executing: ${message.data.node}`);
            }
            break;

          case "executed":
            logger.debug(`[ComfyUI] Node executed: ${message.data.node}`);
            break;
        }
      } catch (error) {
        logger.warn(`[ComfyUI] WebSocket message parse error:`, error);
      }
    });

    ws.on("error", error => {
      logger.warn(`[ComfyUI] WebSocket error:`, error);
    });
  }

  /**
   * Wait for workflow completion
   */
  async waitForCompletion(promptId, maxWaitTime = 300000) {
    // 5 minutes max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await fetch(`${this.baseUrl}/history/${promptId}`);
        const history = await response.json();

        if (history[promptId]) {
          logger.info(`[ComfyUI] Workflow completed: ${promptId}`);
          return history[promptId];
        }

        // Wait before next check
        await new Promise(resolve => {
          setTimeout(resolve, 1000);
        });
      } catch (error) {
        logger.warn(`[ComfyUI] Error checking completion:`, error);
        await new Promise(resolve => {
          setTimeout(resolve, 2000);
        });
      }
    }

    throw new Error(`Workflow timeout after ${maxWaitTime}ms`);
  }

  /**
   * Get generation results
   */
  async getGenerationResults(promptId) {
    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);
      const history = await response.json();
      const outputs = history[promptId]?.outputs || {};

      const images = [];

      for (const [, nodeOutput] of Object.entries(outputs)) {
        if (nodeOutput.images) {
          for (const imageInfo of nodeOutput.images) {
            const imageUrl = `${this.baseUrl}/view?${new URLSearchParams({
              filename: imageInfo.filename,
              subfolder: imageInfo.subfolder || "",
              type: imageInfo.type || "output",
            })}`;

            const imageResponse = await fetch(imageUrl);

            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              images.push({
                filename: imageInfo.filename,
                data: Buffer.from(imageBuffer),
                type: "buffer",
              });
            }
          }
        }
      }

      return images;
    } catch (error) {
      logger.error(`[ComfyUI] Failed to get results:`, error);
      throw error;
    }
  }

  /**
   * Extract model name from workflow
   */
  extractModelFromWorkflow(workflowData) {
    for (const node of Object.values(workflowData)) {
      if (node.class_type === "CheckpointLoaderSimple") {
        return node.inputs?.ckpt_name || "unknown";
      }
    }
    return "unknown";
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Health check with deployment awareness
   */
  async healthCheck() {
    await this.initializeManagers();

    try {
      const deployment = await deploymentManager.getBestDeployment();
      return await deployment.healthCheck();
    } catch (error) {
      logger.warn(`[ComfyUI] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Parse bot command flags and convert to model selection
   * Enhanced with model manager integration
   */
  parseCommandFlags(commandText) {
    return modelManager.parseModelFlags(commandText);
  }

  /**
   * Generate image from bot command with flag parsing
   * Enhanced with manager integration
   */
  async generateFromCommand(prompt, commandText, options = {}) {
    const selectedModel = this.parseCommandFlags(commandText);

    // Parse additional flags for generation options
    const generationOptions = {};

    // Extract quality flags
    if (/--fast|--quick/i.test(commandText)) {
      generationOptions.steps = 15;
      generationOptions.cfg = 6;
    }
    if (/--quality|--hq|--high-quality/i.test(commandText)) {
      generationOptions.steps = 30;
      generationOptions.cfg = 8;
    }

    // Extract workflow flags
    if (/--avatar/i.test(commandText)) {
      generationOptions.workflow = "anime-avatar-generation";
    }

    const sizeMatch = commandText.match(/--size[=\s](\d+)x(\d+)/i);
    if (sizeMatch) {
      generationOptions.width = parseInt(sizeMatch[1]);
      generationOptions.height = parseInt(sizeMatch[2]);
    }

    // Merge options
    const finalOptions = {
      ...generationOptions,
      ...options,
      flags: selectedModel.flags,
    };

    logger.info(
      `[ComfyUI] Generating with model: ${selectedModel.filename}, options:`,
      finalOptions,
    );

    return await this.generateImage(
      prompt,
      selectedModel.filename,
      finalOptions,
    );
  }

  /**
   * Get help text for bot commands
   */
  getHelpText() {
    return `
**ComfyUI Model Selection:**
\`--model animagine\` - Animagine XL 4.0 (default, best quality)
\`--model anything\` - Anything XL (alternative anime style)

**Required Flags:**
\`--nsfw\` - Required for all anime models (safety measure)

**Aspect Ratio:**
\`--ar 1:1\` - Square (default)
\`--ar 16:9\` - Widescreen
\`--ar 9:16\` - Portrait

**Examples:**
\`/imagine anime girl --nsfw --model animagine --ar 1:1\`
\`/imagine fantasy warrior --nsfw --model anything --ar 16:9\`
    `.trim();
  }

  /**
   * Get enhanced status with manager information
   */
  async getStatus() {
    await this.initializeManagers();

    const status = {
      initialized: this.initialized,
      managers: {
        config: configManager.getConfigSummary(),
        models: modelManager.getModelStats(),
        workflows: await workflowManager.getWorkflowStats(),
        deployments: await deploymentManager.getDeploymentStatus(),
      },
    };

    return status;
  }
}

export default ComfyUIProvider;
