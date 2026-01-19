/**
 * ComfyUI Workflow Manager
 * Handles workflow loading, management, and parameter injection
 */

import { getLogger } from "../../../logger.js";
import fs from "fs/promises";
import path from "path";

const logger = getLogger();

export class WorkflowManager {
  constructor() {
    this.workflows = new Map();
    this.initialized = false;
  }

  /**
   * Initialize available workflows
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const workflowsPath = path.join(
        process.cwd(),
        "src/utils/ai/providers/comfyui/workflows",
      );

      // Ensure directory exists
      try {
        await fs.mkdir(workflowsPath, { recursive: true });
      } catch (err) {
        logger.warn(
          `[WorkflowManager] Could not create workflows directory: ${err.message}`,
        );
      }

      let files = [];
      try {
        files = await fs.readdir(workflowsPath);
      } catch (err) {
        logger.warn(
          `[WorkflowManager] Could not read workflows directory: ${err.message}`,
        );
      }

      for (const file of files) {
        if (file.endsWith(".json")) {
          const workflowName = file.replace(".json", "");
          const workflowPath = path.join(workflowsPath, file);
          const workflowData = JSON.parse(
            await fs.readFile(workflowPath, "utf8"),
          );

          this.workflows.set(workflowName, {
            name: workflowName,
            path: workflowPath,
            data: workflowData,
            metadata: this.extractWorkflowMetadata(workflowData),
          });
        }
      }

      this.initialized = true;
      logger.info(`[WorkflowManager] Loaded ${this.workflows.size} workflows`);
    } catch (error) {
      logger.error(`[WorkflowManager] Initialization error:`, error);
      // Don't re-throw, as we can still function with dynamic workflows
      this.initialized = true;
    }
  }

  /**
   * Extract metadata from workflow
   */
  extractWorkflowMetadata(workflowData) {
    const metadata = {
      nodeCount: Object.keys(workflowData).length,
      hasKSampler: false,
      hasControlNet: false,
      hasLoRA: false,
      estimatedSteps: 20,
      estimatedCFG: 7.0,
      supportedSizes: [],
      requiredModels: [],
      nodeTypes: new Set(),
    };

    // Analyze workflow structure
    for (const [, node] of Object.entries(workflowData)) {
      const classType = node.class_type;
      metadata.nodeTypes.add(classType);

      if (classType === "KSampler") {
        metadata.hasKSampler = true;
        if (node.inputs?.steps) metadata.estimatedSteps = node.inputs.steps;
        if (node.inputs?.cfg) metadata.estimatedCFG = node.inputs.cfg;
      } else if (classType === "CheckpointLoaderSimple") {
        if (node.inputs?.ckpt_name) {
          metadata.requiredModels.push(node.inputs.ckpt_name);
        }
      } else if (classType === "EmptyLatentImage") {
        if (node.inputs?.width && node.inputs?.height) {
          metadata.supportedSizes.push(
            `${node.inputs.width}x${node.inputs.height}`,
          );
        }
      } else if (classType && classType.includes("ControlNet")) {
        metadata.hasControlNet = true;
      } else if (
        classType &&
        (classType.includes("LoRA") || classType.includes("Lora"))
      ) {
        metadata.hasLoRA = true;
      }
    }

    // Convert Set to Array for serialization
    metadata.nodeTypes = Array.from(metadata.nodeTypes);

    return metadata;
  }

  /**
   * Get available workflows
   */
  async getAvailableWorkflows() {
    await this.initialize();

    return Array.from(this.workflows.values()).map(workflow => ({
      name: workflow.name,
      metadata: workflow.metadata,
    }));
  }

  /**
   * Get workflow by name
   */
  async getWorkflow(name) {
    await this.initialize();

    const workflow = this.workflows.get(name);
    if (!workflow) {
      throw new Error(`Workflow '${name}' not found`);
    }

    return workflow;
  }

  /**
   * Get workflow data with parameters injected (Now creates dynamic workflows without files)
   */
  async getWorkflowWithParameters(name, parameters = {}) {
    // We ignore 'name' now and generate the best possible direct workflow for the model
    const workflowData = this.generateDirectWorkflow(parameters);

    return {
      name: parameters.model || "universal",
      data: workflowData,
      parameters,
    };
  }

  /**
   * Generates a high-quality ComfyUI API graph in memory
   */
  generateDirectWorkflow(params) {
    const {
      model,
      prompt,
      negativePrompt,
      steps,
      cfg,
      width,
      height,
      seed,
      sampler_name: samplerName,
      scheduler,
    } = params;

    const finalWidth = width || 1024;
    const finalHeight = height || 1024;

    return {
      2: {
        inputs: { ckpt_name: model || "AnythingXL_xl.safetensors" },
        class_type: "CheckpointLoaderSimple",
        _meta: { title: "Load Checkpoint" },
      },
      9: {
        inputs: {
          stop_at_clip_layer: -2,
          clip: ["2", 1],
        },
        class_type: "CLIPSetLastLayer",
        _meta: { title: "Clip Skip 2" },
      },
      3: {
        inputs: {
          text: prompt,
          clip: ["9", 0],
        },
        class_type: "CLIPTextEncode",
        _meta: { title: "Positive Prompt" },
      },
      4: {
        inputs: {
          text: negativePrompt || "",
          clip: ["9", 0],
        },
        class_type: "CLIPTextEncode",
        _meta: { title: "Negative Prompt" },
      },
      5: {
        inputs: {
          width: finalWidth,
          height: finalHeight,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
        _meta: { title: "Empty Latent Image" },
      },
      6: {
        inputs: {
          seed: seed || Math.floor(Math.random() * 1000000000),
          steps: steps || 30,
          cfg: cfg || 7.0,
          sampler_name: samplerName || "dpmpp_2m",
          scheduler: scheduler || "karras",
          denoise: 1.0,
          model: ["2", 0],
          positive: ["3", 0],
          negative: ["4", 0],
          latent_image: ["5", 0],
        },
        class_type: "KSampler",
        _meta: { title: "KSampler" },
      },
      7: {
        inputs: { samples: ["6", 0], vae: ["2", 2] },
        class_type: "VAEDecode",
        _meta: { title: "VAE Decode" },
      },
      8: {
        inputs: { filename_prefix: "anime_nsfw", images: ["7", 0] },
        class_type: "SaveImage",
        _meta: { title: "Save Image" },
      },
    };
  }

  /**
   * Inject parameters into workflow
   */
  injectParameters(workflowData, params) {
    const { model, prompt, negativePrompt, steps, cfg, width, height, seed } =
      params;

    // Find positive and negative prompt node IDs from KSampler
    let positiveNodeId = null;
    let negativeNodeId = null;

    // First, find the KSampler to identify which nodes are positive/negative
    for (const [, node] of Object.entries(workflowData)) {
      if (node.class_type === "KSampler") {
        if (node.inputs.positive && Array.isArray(node.inputs.positive)) {
          positiveNodeId = node.inputs.positive[0].toString();
        }
        if (node.inputs.negative && Array.isArray(node.inputs.negative)) {
          negativeNodeId = node.inputs.negative[0].toString();
        }
        break;
      }
    }

    // Find and update nodes
    for (const [nodeId, node] of Object.entries(workflowData)) {
      const classType = node.class_type;

      // Update checkpoint loader
      if (classType === "CheckpointLoaderSimple" && model) {
        node.inputs.ckpt_name = model;
      }

      // Update text encoders using node IDs from KSampler
      if (classType === "CLIPTextEncode") {
        if (nodeId === positiveNodeId && prompt) {
          node.inputs.text = prompt;
        } else if (nodeId === negativeNodeId && negativePrompt !== undefined) {
          node.inputs.text = negativePrompt;
        }
      }

      // Update KSampler
      if (classType === "KSampler") {
        if (steps !== null && steps !== undefined) node.inputs.steps = steps;
        if (cfg !== null && cfg !== undefined) node.inputs.cfg = cfg;
        if (params.sampler_name) node.inputs.sampler_name = params.sampler_name;
        if (params.scheduler) node.inputs.scheduler = params.scheduler;
        if (seed !== null && seed !== undefined) {
          node.inputs.seed = seed;
        } else {
          // Generate random seed
          node.inputs.seed = Math.floor(Math.random() * 1000000000);
        }
      }

      // Update latent image size
      if (classType === "EmptyLatentImage") {
        if (width) node.inputs.width = width;
        if (height) node.inputs.height = height;
      }
    }
  }

  /**
   * Validate workflow
   */
  async validateWorkflow(name) {
    try {
      const workflow = await this.getWorkflow(name);
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        metadata: workflow.metadata,
      };

      // Check for required nodes
      const requiredNodes = ["CheckpointLoaderSimple", "KSampler", "SaveImage"];
      for (const requiredNode of requiredNodes) {
        if (!workflow.metadata.nodeTypes.includes(requiredNode)) {
          validation.errors.push(`Missing required node type: ${requiredNode}`);
        }
      }

      // Check for text encoders
      if (!workflow.metadata.nodeTypes.includes("CLIPTextEncode")) {
        validation.warnings.push(
          "No text encoder found - prompt injection may not work",
        );
      }

      // Check for latent image node
      if (!workflow.metadata.nodeTypes.includes("EmptyLatentImage")) {
        validation.warnings.push(
          "No latent image node found - size control may not work",
        );
      }

      validation.valid = validation.errors.length === 0;
      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
        metadata: null,
      };
    }
  }

  /**
   * Get workflow recommendations based on requirements
   */
  async getWorkflowRecommendations(requirements = {}) {
    await this.initialize();

    const {
      hasControlNet = false,
      hasLoRA = false,
      preferredSteps = null,
      maxNodes = null,
    } = requirements;

    const recommendations = [];

    for (const workflow of this.workflows.values()) {
      let score = 0;
      const reasons = [];

      // Score based on requirements
      if (hasControlNet && workflow.metadata.hasControlNet) {
        score += 10;
        reasons.push("Has ControlNet support");
      }

      if (hasLoRA && workflow.metadata.hasLoRA) {
        score += 10;
        reasons.push("Has LoRA support");
      }

      if (
        preferredSteps &&
        Math.abs(workflow.metadata.estimatedSteps - preferredSteps) <= 5
      ) {
        score += 5;
        reasons.push(
          `Steps close to preferred (${workflow.metadata.estimatedSteps})`,
        );
      }

      if (maxNodes && workflow.metadata.nodeCount <= maxNodes) {
        score += 3;
        reasons.push(`Efficient node count (${workflow.metadata.nodeCount})`);
      }

      // Base score for having essential nodes
      if (workflow.metadata.hasKSampler) {
        score += 5;
        reasons.push("Has KSampler");
      }

      recommendations.push({
        name: workflow.name,
        score,
        reasons,
        metadata: workflow.metadata,
      });
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats() {
    await this.initialize();

    const stats = {
      total: this.workflows.size,
      withControlNet: 0,
      withLoRA: 0,
      withKSampler: 0,
      averageNodes: 0,
      averageSteps: 0,
      averageCFG: 0,
    };

    let totalNodes = 0;
    let totalSteps = 0;
    let totalCFG = 0;

    for (const workflow of this.workflows.values()) {
      if (workflow.metadata.hasControlNet) stats.withControlNet++;
      if (workflow.metadata.hasLoRA) stats.withLoRA++;
      if (workflow.metadata.hasKSampler) stats.withKSampler++;

      totalNodes += workflow.metadata.nodeCount;
      totalSteps += workflow.metadata.estimatedSteps;
      totalCFG += workflow.metadata.estimatedCFG;
    }

    if (this.workflows.size > 0) {
      stats.averageNodes = Math.round(totalNodes / this.workflows.size);
      stats.averageSteps = Math.round(totalSteps / this.workflows.size);
      stats.averageCFG = Math.round((totalCFG / this.workflows.size) * 10) / 10;
    }

    return stats;
  }

  /**
   * Reload workflows from disk
   */
  async reload() {
    this.workflows.clear();
    this.initialized = false;
    await this.initialize();
    logger.info(`[WorkflowManager] Reloaded ${this.workflows.size} workflows`);
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager();
export default workflowManager;
