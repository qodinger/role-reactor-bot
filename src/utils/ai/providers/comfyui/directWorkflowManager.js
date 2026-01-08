/**
 * Direct ComfyUI Workflow Manager
 * Uses ComfyUI's saved workflows directly without parameter injection
 */

import { getLogger } from "../../../logger.js";

const logger = getLogger();

export class DirectWorkflowManager {
  constructor() {
    this.comfyuiBaseUrl = "http://127.0.0.1:8188";
  }

  /**
   * Get workflows saved in ComfyUI directly
   */
  async getComfyUIWorkflows() {
    try {
      // Get workflows from ComfyUI's workflow directory
      const response = await fetch(`${this.comfyuiBaseUrl}/api/workflows`);
      if (!response.ok) {
        throw new Error("Could not fetch ComfyUI workflows");
      }
      return await response.json();
    } catch (error) {
      logger.warn(
        "[DirectWorkflowManager] Could not fetch ComfyUI workflows:",
        error,
      );
      return [];
    }
  }

  /**
   * Queue a workflow in ComfyUI using its saved workflow name
   */
  async queueWorkflowByName(workflowName, overrides = {}) {
    try {
      const response = await fetch(`${this.comfyuiBaseUrl}/api/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_name: workflowName,
          overrides, // Only override essential parameters
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to queue workflow: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("[DirectWorkflowManager] Failed to queue workflow:", error);
      throw error;
    }
  }

  /**
   * Generate using ComfyUI's saved workflow with minimal overrides
   */
  async generateWithSavedWorkflow(workflowName, prompt, model = null) {
    const overrides = {
      // Only override the most essential parameters
      positive_prompt: prompt,
      // Let ComfyUI use its saved settings for everything else
    };

    if (model) {
      overrides.checkpoint = model;
    }

    return await this.queueWorkflowByName(workflowName, overrides);
  }
}

export const directWorkflowManager = new DirectWorkflowManager();
export default directWorkflowManager;
