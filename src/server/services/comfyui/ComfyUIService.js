/**
 * ComfyUI API Service
 * Provides REST API endpoints for managing ComfyUI workflows and models
 */

import { BaseService } from "../BaseService.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

export class ComfyUIService extends BaseService {
  constructor() {
    super({
      name: "comfyui",
      version: "v1",
      basePath: "/api/v1/comfyui",
      metadata: {
        description: "ComfyUI workflow and model management API",
        features: [
          "List available workflows",
          "Get workflow details",
          "List available models",
          "Change active workflow",
          "Change active model",
          "Get ComfyUI status",
        ],
        endpoints: [
          "GET /workflows - List all workflows",
          "GET /workflows/:name - Get workflow details",
          "POST /workflows/active - Set active workflow",
          "GET /models - List all models",
          "GET /models/:filename - Get model details",
          "POST /models/active - Set active model",
          "GET /status - Get ComfyUI provider status",
          "POST /reload - Reload workflows from disk",
        ],
      },
    });

    this.comfyuiProvider = null;
    this.setupRoutes();
  }

  /**
   * Initialize ComfyUI provider reference
   */
  async initializeProvider() {
    if (this.comfyuiProvider) return this.comfyuiProvider;

    try {
      // Import and initialize ComfyUI provider
      const { ComfyUIProvider } = await import(
        "../../../utils/ai/providers/ComfyUIProvider.js"
      );
      const { getAIModels } = await import("../../../config/ai.js");

      const aiConfig = getAIModels();
      const comfyuiConfig = aiConfig.providers.comfyui;

      if (!comfyuiConfig.enabled) {
        throw new Error("ComfyUI provider is not enabled in configuration");
      }

      this.comfyuiProvider = new ComfyUIProvider(comfyuiConfig);
      await this.comfyuiProvider.initializeManagers();

      logger.info("[ComfyUIService] Provider initialized successfully");
      return this.comfyuiProvider;
    } catch (error) {
      logger.error("[ComfyUIService] Failed to initialize provider:", error);
      throw error;
    }
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Workflow endpoints
    this.get("/workflows", this.asyncHandler(this.listWorkflows.bind(this)));
    this.get(
      "/workflows/available",
      this.asyncHandler(this.getAvailableWorkflows.bind(this)),
    ); // Move before :name route
    this.get(
      "/workflows/:name",
      this.asyncHandler(this.getWorkflow.bind(this)),
    );
    this.post(
      "/workflows/active",
      this.asyncHandler(this.setActiveWorkflow.bind(this)),
    );
    this.post(
      "/workflows/reload",
      this.asyncHandler(this.reloadWorkflows.bind(this)),
    );

    // NEW: Workflow selection endpoints
    this.post(
      "/workflows/select",
      this.asyncHandler(this.selectWorkflow.bind(this)),
    );
    this.post("/workflows/use", this.asyncHandler(this.useWorkflow.bind(this)));

    // Model endpoints
    this.get("/models", this.asyncHandler(this.listModels.bind(this)));
    this.get("/models/:filename", this.asyncHandler(this.getModel.bind(this)));
    this.post(
      "/models/active",
      this.asyncHandler(this.setActiveModel.bind(this)),
    );

    // Status endpoints
    this.get("/status", this.asyncHandler(this.getStatus.bind(this)));
    this.get("/health", this.asyncHandler(this.getHealth.bind(this)));

    // Generation endpoint (for testing)
    this.post("/generate", this.asyncHandler(this.generateImage.bind(this)));
  }

  /**
   * List all available workflows
   */
  async listWorkflows(req, res) {
    try {
      const provider = await this.initializeProvider();
      const workflows = await provider.getAvailableWorkflows();

      this.sendSuccess(res, {
        workflows,
        count: workflows.length,
      });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to list workflows:", error);
      this.sendError(res, "Failed to list workflows", 500);
    }
  }

  /**
   * Get specific workflow details
   */
  async getWorkflow(req, res) {
    try {
      const { name } = req.params;
      await this.initializeProvider();

      // Get workflow manager from provider
      const { workflowManager } = await import(
        "../../../utils/ai/providers/comfyui/workflowManager.js"
      );
      const workflow = await workflowManager.getWorkflow(name);

      this.sendSuccess(res, {
        workflow: {
          name: workflow.name,
          path: workflow.path,
          metadata: workflow.metadata,
          // Don't send the full workflow data by default (can be large)
          hasData: !!workflow.data,
        },
      });
    } catch (error) {
      if (error.message.includes("not found")) {
        this.sendError(res, `Workflow '${req.params.name}' not found`, 404);
      } else {
        logger.error("[ComfyUIService] Failed to get workflow:", error);
        this.sendError(res, "Failed to get workflow", 500);
      }
    }
  }

  /**
   * Set active workflow (for future generations)
   */
  async setActiveWorkflow(req, res) {
    try {
      const { workflowName } = req.body;

      if (!workflowName) {
        return this.sendError(res, "workflowName is required", 400);
      }

      await this.initializeProvider();

      // Validate workflow exists
      const { workflowManager } = await import(
        "../../../utils/ai/providers/comfyui/workflowManager.js"
      );
      const workflow = await workflowManager.getWorkflow(workflowName);

      // Store active workflow preference (could be stored in config or database)
      // For now, just validate it exists and return success

      this.sendSuccess(res, {
        message: `Active workflow set to '${workflowName}'`,
        workflow: {
          name: workflow.name,
          metadata: workflow.metadata,
        },
      });
    } catch (error) {
      if (error.message.includes("not found")) {
        this.sendError(
          res,
          `Workflow '${req.body.workflowName}' not found`,
          404,
        );
      } else {
        logger.error("[ComfyUIService] Failed to set active workflow:", error);
        this.sendError(res, "Failed to set active workflow", 500);
      }
    }
  }

  /**
   * Reload workflows from disk
   */
  async reloadWorkflows(req, res) {
    try {
      const { workflowManager } = await import(
        "../../../utils/ai/providers/comfyui/workflowManager.js"
      );
      await workflowManager.reload();

      const workflows = await workflowManager.getAvailableWorkflows();

      this.sendSuccess(res, {
        message: "Workflows reloaded successfully",
        count: workflows.length,
        workflows,
      });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to reload workflows:", error);
      this.sendError(res, "Failed to reload workflows", 500);
    }
  }

  /**
   * List all available models
   */
  async listModels(req, res) {
    try {
      const provider = await this.initializeProvider();
      const { flags } = req.query;

      let models;
      if (flags) {
        const flagArray = flags.split(",").map(f => f.trim());
        models = provider.getAvailableModels(flagArray);
      } else {
        models = provider.getAvailableModels();
      }

      this.sendSuccess(res, {
        models,
        count: models.length,
        availableFlags: ["anime", "realistic", "nsfw"],
      });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to list models:", error);
      this.sendError(res, "Failed to list models", 500);
    }
  }

  /**
   * Get specific model details
   */
  async getModel(req, res) {
    try {
      const { filename } = req.params;
      await this.initializeProvider();

      // Get model manager from provider
      const { modelManager } = await import(
        "../../../utils/ai/providers/comfyui/modelManager.js"
      );
      const model = modelManager.getModelByFilename(filename);

      this.sendSuccess(res, { model });
    } catch (error) {
      if (error.message.includes("not found")) {
        this.sendError(res, `Model '${req.params.filename}' not found`, 404);
      } else {
        logger.error("[ComfyUIService] Failed to get model:", error);
        this.sendError(res, "Failed to get model", 500);
      }
    }
  }

  /**
   * Set active model (for future generations)
   */
  async setActiveModel(req, res) {
    try {
      const { modelFilename } = req.body;

      if (!modelFilename) {
        return this.sendError(res, "modelFilename is required", 400);
      }

      await this.initializeProvider();

      // Validate model exists
      const { modelManager } = await import(
        "../../../utils/ai/providers/comfyui/modelManager.js"
      );
      const model = modelManager.getModelByFilename(modelFilename);

      // Store active model preference (could be stored in config or database)
      // For now, just validate it exists and return success

      this.sendSuccess(res, {
        message: `Active model set to '${modelFilename}'`,
        model,
      });
    } catch (error) {
      if (error.message.includes("not found")) {
        this.sendError(res, `Model '${req.body.modelFilename}' not found`, 404);
      } else {
        logger.error("[ComfyUIService] Failed to set active model:", error);
        this.sendError(res, "Failed to set active model", 500);
      }
    }
  }

  /**
   * Get ComfyUI provider status
   */
  async getStatus(req, res) {
    try {
      const provider = await this.initializeProvider();
      const status = await provider.getStatus();

      this.sendSuccess(res, { status });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to get status:", error);
      this.sendError(res, "Failed to get status", 500);
    }
  }

  /**
   * Get ComfyUI health check
   */
  async getHealth(req, res) {
    try {
      const provider = await this.initializeProvider();
      const healthy = await provider.healthCheck();

      this.sendSuccess(res, {
        healthy,
        status: healthy ? "ok" : "error",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[ComfyUIService] Health check failed:", error);
      this.sendError(res, "Health check failed", 500);
    }
  }

  /**
   * Get all available workflows (history + files)
   */
  async getAvailableWorkflows(req, res) {
    try {
      const { workflowSelector } = await import(
        "../../../utils/ai/providers/comfyui/workflowSelector.js"
      );
      const workflows = await workflowSelector.listAvailableWorkflows();

      this.sendSuccess(res, {
        workflows,
        summary: {
          historyCount: workflows.history.length,
          fileCount: workflows.files.length,
          total: workflows.history.length + workflows.files.length,
        },
      });
    } catch (error) {
      logger.error(
        "[ComfyUIService] Failed to get available workflows:",
        error,
      );
      this.sendError(res, "Failed to get available workflows", 500);
    }
  }

  /**
   * Select a specific workflow
   */
  async selectWorkflow(req, res) {
    try {
      const {
        method = "auto",
        workflowId,
        workflowName,
        type = "anime",
        preferRecent = true,
        fallbackToFile = true,
      } = req.body;

      const { workflowSelector } = await import(
        "../../../utils/ai/providers/comfyui/workflowSelector.js"
      );

      const selectedWorkflow = await workflowSelector.selectWorkflow({
        method,
        workflowId,
        workflowName,
        type,
        preferRecent,
        fallbackToFile,
      });

      this.sendSuccess(res, {
        message: "Workflow selected successfully",
        workflow: {
          source: selectedWorkflow.source,
          id: selectedWorkflow.id,
          name: selectedWorkflow.name,
          metadata: selectedWorkflow.metadata,
        },
      });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to select workflow:", error);
      this.sendError(res, `Failed to select workflow: ${error.message}`, 400);
    }
  }

  /**
   * Use a workflow with parameters
   */
  async useWorkflow(req, res) {
    try {
      const {
        method = "auto",
        workflowId,
        workflowName,
        type = "anime",
        prompt = "beautiful anime girl",
        negativePrompt = "",
        seed,
        model = "AnythingXL_xl.safetensors",
      } = req.body;

      if (!prompt) {
        return this.sendError(res, "prompt is required", 400);
      }

      const { workflowSelector } = await import(
        "../../../utils/ai/providers/comfyui/workflowSelector.js"
      );

      // Select workflow
      const selectedWorkflow = await workflowSelector.selectWorkflow({
        method,
        workflowId,
        workflowName,
        type,
      });

      // Use workflow with parameters
      const result = await workflowSelector.useWorkflow(selectedWorkflow, {
        prompt,
        negativePrompt,
        seed,
        model,
      });

      this.sendSuccess(res, {
        message: "Workflow executed successfully",
        promptId: result.prompt_id,
        workflow: {
          source: selectedWorkflow.source,
          name: selectedWorkflow.metadata.name,
        },
        parameters: {
          prompt,
          negativePrompt,
          seed,
          model,
        },
      });
    } catch (error) {
      logger.error("[ComfyUIService] Failed to use workflow:", error);
      this.sendError(res, `Failed to use workflow: ${error.message}`, 500);
    }
  }
  async generateImage(req, res) {
    try {
      const {
        prompt,
        model,
        workflow = null, // Will auto-select from available workflows
        steps = 20,
        cfg = 7,
        width = 1024,
        height = 1024,
        seed,
        negativePrompt = "",
      } = req.body;

      if (!prompt) {
        return this.sendError(res, "prompt is required", 400);
      }

      const provider = await this.initializeProvider();

      // Auto-select workflow if not specified
      let selectedWorkflow = workflow;
      if (!selectedWorkflow) {
        const availableWorkflows = await provider.getAvailableWorkflows();
        if (availableWorkflows.length > 0) {
          selectedWorkflow = availableWorkflows[0].name;
        } else {
          return this.sendError(res, "No workflows available", 500);
        }
      }

      const config = {
        steps,
        cfg,
        width,
        height,
        seed,
        negativePrompt,
        workflow: selectedWorkflow,
      };

      const result = await provider.generateImage(prompt, model, config);

      // Return image as base64 data URL
      this.sendSuccess(res, {
        message: "Image generated successfully",
        result: {
          imageUrl: result.imageUrl,
          model: result.model,
          provider: result.provider,
          prompt: result.prompt,
          config,
        },
      });
    } catch (error) {
      logger.error("[ComfyUIService] Image generation failed:", error);
      this.sendError(res, `Image generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth() {
    try {
      const provider = await this.initializeProvider();
      const healthy = await provider.healthCheck();

      return {
        status: healthy ? "healthy" : "unhealthy",
        details: {
          providerInitialized: !!this.comfyuiProvider,
          comfyuiHealthy: healthy,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error.message,
          providerInitialized: !!this.comfyuiProvider,
        },
      };
    }
  }
}

export default ComfyUIService;
