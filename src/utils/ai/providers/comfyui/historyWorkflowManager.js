/**
 * History-Based Workflow Manager
 * Uses ComfyUI's history API to find and reuse workflows
 */

import { getLogger } from "../../../logger.js";
import fs from "fs/promises";

const logger = getLogger();

export class HistoryWorkflowManager {
  constructor() {
    this.baseUrl = "http://127.0.0.1:8188";
    this.workflowCache = new Map();
    this.cacheFile = "workflow-cache.json";
  }

  /**
   * Scan ComfyUI history for workflows
   */
  async scanHistoryForWorkflows() {
    try {
      const response = await fetch(`${this.baseUrl}/history`);
      if (!response.ok) {
        throw new Error(`History API failed: ${response.status}`);
      }

      const history = await response.json();
      const workflows = [];

      for (const [promptId, entry] of Object.entries(history)) {
        if (entry.prompt && entry.outputs) {
          const workflow = this.analyzeWorkflow(promptId, entry);
          if (workflow) {
            workflows.push(workflow);
          }
        }
      }

      logger.info(
        `[HistoryWorkflowManager] Found ${workflows.length} workflows in history`,
      );
      return workflows;
    } catch (error) {
      logger.error("[HistoryWorkflowManager] Failed to scan history:", error);
      return [];
    }
  }

  /**
   * Analyze a workflow from history entry
   */
  analyzeWorkflow(promptId, entry) {
    try {
      const prompt = entry.prompt;
      const nodeCount = Object.keys(prompt).length;

      // Extract workflow characteristics
      const characteristics = {
        promptId,
        nodeCount,
        timestamp: entry.timestamp || Date.now(),
        hasCheckpoint: false,
        hasKSampler: false,
        hasVAE: false,
        model: null,
        sampler: null,
        steps: null,
        cfg: null,
        size: null,
        type: "unknown",
      };

      // Analyze nodes
      for (const [, node] of Object.entries(prompt)) {
        switch (node.class_type) {
          case "CheckpointLoaderSimple":
            characteristics.hasCheckpoint = true;
            characteristics.model = node.inputs?.ckpt_name;
            break;
          case "KSampler":
            characteristics.hasKSampler = true;
            characteristics.sampler = node.inputs?.sampler_name;
            characteristics.steps = node.inputs?.steps;
            characteristics.cfg = node.inputs?.cfg;
            break;
          case "VAEDecode":
            characteristics.hasVAE = true;
            break;
          case "EmptyLatentImage":
            if (node.inputs?.width && node.inputs?.height) {
              characteristics.size = `${node.inputs.width}x${node.inputs.height}`;
            }
            break;
        }
      }

      // Determine workflow type
      if (characteristics.model) {
        if (characteristics.model.toLowerCase().includes("anything")) {
          characteristics.type = "anime";
        } else if (characteristics.model.toLowerCase().includes("realism")) {
          characteristics.type = "realistic";
        } else {
          characteristics.type = "anime"; // Default fallback to anime
        }
      }

      // Only return workflows that look complete
      if (
        characteristics.hasCheckpoint &&
        characteristics.hasKSampler &&
        characteristics.hasVAE
      ) {
        return {
          id: promptId,
          workflow: prompt,
          characteristics,
          metadata: {
            name: `${characteristics.type}-${characteristics.nodeCount}nodes-${characteristics.steps}steps`,
            description: `${characteristics.type} workflow with ${characteristics.nodeCount} nodes`,
            compatible: true,
          },
        };
      }

      return null;
    } catch (error) {
      logger.warn(
        `[HistoryWorkflowManager] Failed to analyze workflow ${promptId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Find best workflow for requirements
   */
  async findBestWorkflow(requirements = {}) {
    const {
      type = "anime",
      preferRecent = true,
      minNodes = 5,
      maxNodes = 20,
    } = requirements;

    // Get workflows from history
    const workflows = await this.scanHistoryForWorkflows();

    // Filter by requirements
    const filtered = workflows.filter(w => {
      const char = w.characteristics;
      return (
        char.type === type &&
        char.nodeCount >= minNodes &&
        char.nodeCount <= maxNodes
      );
    });

    if (filtered.length === 0) {
      logger.warn(
        `[HistoryWorkflowManager] No workflows found for type: ${type}`,
      );
      return null;
    }

    // Sort by preference (recent first, or by quality metrics)
    filtered.sort((a, b) => {
      if (preferRecent) {
        return b.characteristics.timestamp - a.characteristics.timestamp;
      }
      // Could add other sorting criteria here
      return b.characteristics.nodeCount - a.characteristics.nodeCount;
    });

    const best = filtered[0];
    logger.info(
      `[HistoryWorkflowManager] Selected workflow: ${best.metadata.name}`,
    );

    return best;
  }

  /**
   * Use workflow with minimal parameter injection
   */
  async useWorkflow(workflowId, overrides = {}) {
    try {
      // Get workflow from history
      const response = await fetch(`${this.baseUrl}/history/${workflowId}`);
      if (!response.ok) {
        throw new Error(`Failed to get workflow ${workflowId}`);
      }

      const historyEntry = await response.json();
      const workflow = historyEntry[workflowId]?.prompt;

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found in history`);
      }

      // Apply minimal overrides
      const modifiedWorkflow = this.applyMinimalOverrides(workflow, overrides);

      // Submit to ComfyUI
      const clientId = this.generateClientId();
      const submitResponse = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: modifiedWorkflow,
          client_id: clientId,
        }),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`Workflow submission failed: ${errorText}`);
      }

      const result = await submitResponse.json();
      logger.info(
        `[HistoryWorkflowManager] Workflow submitted: ${result.prompt_id}`,
      );

      return result;
    } catch (error) {
      logger.error("[HistoryWorkflowManager] Failed to use workflow:", error);
      throw error;
    }
  }

  /**
   * Apply minimal overrides to workflow
   */
  applyMinimalOverrides(workflow, overrides) {
    const modified = JSON.parse(JSON.stringify(workflow)); // Deep clone

    const { prompt, negativePrompt, seed, model } = overrides;

    // Only modify essential parameters
    for (const [, node] of Object.entries(modified)) {
      switch (node.class_type) {
        case "CheckpointLoaderSimple": {
          if (model) {
            node.inputs.ckpt_name = model;
          }
          break;
        }

        case "CLIPTextEncode": {
          // Detect positive vs negative by content
          const currentText = node.inputs.text || "";
          const isNegative =
            currentText.includes("worst quality") ||
            currentText.includes("bad anatomy");

          if (!isNegative && prompt) {
            // Combine user prompt with existing quality tags
            node.inputs.text = currentText
              ? `${prompt}, ${currentText}`
              : prompt;
          } else if (isNegative && negativePrompt) {
            // Combine user negative with existing negatives
            node.inputs.text = currentText
              ? `${negativePrompt}, ${currentText}`
              : negativePrompt;
          }
          break;
        }

        case "KSampler": {
          if (seed !== undefined) {
            node.inputs.seed = seed;
          }
          // Preserve all other KSampler settings from the original workflow
          break;
        }
      }
    }

    return modified;
  }

  /**
   * Cache workflows for faster access
   */
  async cacheWorkflows() {
    try {
      const workflows = await this.scanHistoryForWorkflows();

      // Create cache structure
      const cache = {
        timestamp: Date.now(),
        workflows: workflows.reduce((acc, w) => {
          acc[w.id] = {
            characteristics: w.characteristics,
            metadata: w.metadata,
          };
          return acc;
        }, {}),
      };

      await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
      logger.info(
        `[HistoryWorkflowManager] Cached ${workflows.length} workflows`,
      );
    } catch (error) {
      logger.error(
        "[HistoryWorkflowManager] Failed to cache workflows:",
        error,
      );
    }
  }

  /**
   * List available workflow types
   */
  async getAvailableTypes() {
    const workflows = await this.scanHistoryForWorkflows();
    const types = new Set();

    workflows.forEach(w => {
      types.add(w.characteristics.type);
    });

    return Array.from(types);
  }

  /**
   * Generate client ID
   */
  generateClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

export const historyWorkflowManager = new HistoryWorkflowManager();
export default historyWorkflowManager;
