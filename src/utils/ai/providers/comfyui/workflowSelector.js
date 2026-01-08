/**
 * ComfyUI Workflow Selector
 * Provides multiple methods to select and use workflows
 */

import { getLogger } from "../../../logger.js";
import { historyWorkflowManager } from "./historyWorkflowManager.js";
import { workflowManager } from "./workflowManager.js";

const logger = getLogger();

export class WorkflowSelector {
  constructor() {
    this.baseUrl = "http://127.0.0.1:8188";
  }

  /**
   * Select workflow by various methods
   */
  async selectWorkflow(options = {}) {
    const {
      method = "auto", // 'auto', 'history', 'file', 'id', 'name'
      workflowId = null,
      workflowName = null,
      type = "anime",
      preferRecent = true,
      fallbackToFile = true,
    } = options;

    logger.info(
      `[WorkflowSelector] Selecting workflow: method=${method}, type=${type}`,
    );

    switch (method) {
      case "id":
        return await this.selectById(workflowId);

      case "name":
        return await this.selectByName(workflowName);

      case "history":
        return await this.selectFromHistory(type, preferRecent);

      case "file":
        return await this.selectFromFiles(type);

      case "auto":
      default:
        return await this.selectAuto(type, fallbackToFile);
    }
  }

  /**
   * Select workflow by specific ID from history
   */
  async selectById(workflowId) {
    if (!workflowId) {
      throw new Error("Workflow ID is required");
    }

    try {
      const response = await fetch(`${this.baseUrl}/history/${workflowId}`);
      if (!response.ok) {
        throw new Error(`Workflow ${workflowId} not found in history`);
      }

      const historyEntry = await response.json();
      const workflow = historyEntry[workflowId]?.prompt;

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} has no prompt data`);
      }

      logger.info(`[WorkflowSelector] Selected workflow by ID: ${workflowId}`);

      return {
        source: "history-id",
        id: workflowId,
        workflow,
        metadata: {
          name: `History workflow ${workflowId}`,
          method: "id",
        },
      };
    } catch (error) {
      logger.error(
        `[WorkflowSelector] Failed to select by ID ${workflowId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Select workflow by name from files
   */
  async selectByName(workflowName) {
    if (!workflowName) {
      throw new Error("Workflow name is required");
    }

    try {
      const workflow = await workflowManager.getWorkflow(workflowName);

      logger.info(
        `[WorkflowSelector] Selected workflow by name: ${workflowName}`,
      );

      return {
        source: "file-name",
        name: workflowName,
        workflow: workflow.data,
        metadata: {
          name: workflowName,
          method: "name",
          path: workflow.path,
        },
      };
    } catch (error) {
      logger.error(
        `[WorkflowSelector] Failed to select by name ${workflowName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Select best workflow from history
   */
  async selectFromHistory(type = "anime", preferRecent = true) {
    try {
      const historyWorkflow = await historyWorkflowManager.findBestWorkflow({
        type,
        preferRecent,
      });

      if (!historyWorkflow) {
        throw new Error(`No ${type} workflows found in history`);
      }

      logger.info(
        `[WorkflowSelector] Selected from history: ${historyWorkflow.metadata.name}`,
      );

      return {
        source: "history-auto",
        id: historyWorkflow.id,
        workflow: historyWorkflow.workflow,
        metadata: {
          name: historyWorkflow.metadata.name,
          method: "history",
          characteristics: historyWorkflow.characteristics,
        },
      };
    } catch (error) {
      logger.error(`[WorkflowSelector] Failed to select from history:`, error);
      throw error;
    }
  }

  /**
   * Select workflow from files
   */
  async selectFromFiles(type = "anime") {
    try {
      const availableWorkflows = await workflowManager.getAvailableWorkflows();

      if (availableWorkflows.length === 0) {
        throw new Error("No file-based workflows available");
      }

      // Find workflow matching type
      let selectedWorkflow;
      if (type === "anime") {
        selectedWorkflow = availableWorkflows.find(
          w => w.name.includes("anime") || w.name.includes("Anime"),
        );
      } else if (type === "realistic") {
        selectedWorkflow = availableWorkflows.find(
          w => w.name.includes("realistic") || w.name.includes("Realistic"),
        );
      }

      // Fallback to first available
      if (!selectedWorkflow) {
        selectedWorkflow = availableWorkflows[0];
      }

      const workflow = await workflowManager.getWorkflow(selectedWorkflow.name);

      logger.info(
        `[WorkflowSelector] Selected from files: ${selectedWorkflow.name}`,
      );

      return {
        source: "file-auto",
        name: selectedWorkflow.name,
        workflow: workflow.data,
        metadata: {
          name: selectedWorkflow.name,
          method: "file",
          nodeCount: selectedWorkflow.metadata?.nodeCount,
        },
      };
    } catch (error) {
      logger.error(`[WorkflowSelector] Failed to select from files:`, error);
      throw error;
    }
  }

  /**
   * Auto-select best available workflow
   */
  async selectAuto(type = "anime", fallbackToFile = true) {
    // Try history first
    try {
      return await this.selectFromHistory(type, true);
    } catch (historyError) {
      logger.warn(
        `[WorkflowSelector] History selection failed: ${historyError.message}`,
      );

      if (fallbackToFile) {
        try {
          return await this.selectFromFiles(type);
        } catch (fileError) {
          logger.error(
            `[WorkflowSelector] File selection also failed: ${fileError.message}`,
          );
          throw new Error(`No workflows available for type: ${type}`);
        }
      } else {
        throw historyError;
      }
    }
  }

  /**
   * List all available workflows
   */
  async listAvailableWorkflows() {
    const result = {
      history: [],
      files: [],
    };

    // Get history workflows
    try {
      const historyWorkflows =
        await historyWorkflowManager.scanHistoryForWorkflows();
      result.history = historyWorkflows.map(w => ({
        id: w.id,
        name: w.metadata.name,
        type: w.characteristics.type,
        nodeCount: w.characteristics.nodeCount,
        model: w.characteristics.model,
        age: Math.round((Date.now() - w.characteristics.timestamp) / 1000 / 60),
      }));
    } catch (error) {
      logger.warn("[WorkflowSelector] Failed to get history workflows:", error);
    }

    // Get file workflows
    try {
      const fileWorkflows = await workflowManager.getAvailableWorkflows();
      result.files = fileWorkflows.map(w => ({
        name: w.name,
        nodeCount: w.metadata?.nodeCount || 0,
      }));
    } catch (error) {
      logger.warn("[WorkflowSelector] Failed to get file workflows:", error);
    }

    return result;
  }

  /**
   * Use selected workflow with parameters
   */
  async useWorkflow(selectedWorkflow, parameters = {}) {
    const { prompt, negativePrompt, seed, model } = parameters;

    logger.info(
      `[WorkflowSelector] Using workflow from ${selectedWorkflow.source}`,
    );

    if (selectedWorkflow.source.startsWith("history")) {
      // Use history workflow manager for history workflows
      return await historyWorkflowManager.useWorkflow(selectedWorkflow.id, {
        prompt,
        negativePrompt,
        seed,
        model,
      });
    } else {
      // Use regular workflow manager for file workflows
      const workflowWithParams =
        await workflowManager.getWorkflowWithParameters(selectedWorkflow.name, {
          model,
          prompt,
          negativePrompt,
          seed,
        });

      // Submit to ComfyUI
      const clientId = this.generateClientId();
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: workflowWithParams.data,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Workflow submission failed: ${errorText}`);
      }

      const result = await response.json();
      logger.info(`[WorkflowSelector] Workflow submitted: ${result.prompt_id}`);

      return result;
    }
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

export const workflowSelector = new WorkflowSelector();
export default workflowSelector;
