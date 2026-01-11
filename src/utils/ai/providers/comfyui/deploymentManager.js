/**
 * ComfyUI Deployment Manager
 * Handles different deployment types (Local, RunPod) and provider selection
 */

import { getLogger } from "../../../logger.js";

const logger = getLogger();

export class DeploymentManager {
  constructor() {
    this.deployments = new Map();
    this.initialized = false;
  }

  /**
   * Initialize deployment configurations
   */
  initialize(config) {
    if (this.initialized) return;

    // Local ComfyUI deployment
    if (config.providers?.comfyui?.enabled) {
      this.deployments.set("local", {
        type: "local",
        name: "Local ComfyUI",
        config: {
          ...config.providers.comfyui,
          isRunPod: false,
        },
        priority: 1, // Higher priority for development
        healthCheck: () => this.checkLocalHealth(config.providers.comfyui),
        capabilities: {
          realtime: true,
          websocket: true,
          customWorkflows: true,
          privacy: "complete",
          cost: "free",
        },
      });
    }

    // RunPod Serverless deployment
    if (config.providers?.runpod?.enabled) {
      this.deployments.set("runpod", {
        type: "runpod",
        name: "RunPod Serverless",
        config: {
          ...config.providers.runpod,
          isRunPod: true,
          runPod: config.providers.runpod.runPod,
        },
        priority: 2, // Lower priority, fallback
        healthCheck: () => this.checkRunPodHealth(config.providers.runpod),
        capabilities: {
          realtime: false,
          websocket: false,
          customWorkflows: true,
          privacy: "shared",
          cost: "paid",
          scalable: true,
        },
      });
    }

    this.initialized = true;
    logger.info(
      `[DeploymentManager] Initialized ${this.deployments.size} deployments`,
    );
  }

  /**
   * Get best available deployment
   */
  async getBestDeployment(preferences = {}) {
    if (!this.initialized) {
      throw new Error("DeploymentManager not initialized");
    }

    const {
      preferRunPod = false,
      requireRealtime = false,
      requirePrivacy = false,
      maxCost = "any",
    } = preferences;

    const availableDeployments = Array.from(this.deployments.values());

    // Filter by requirements
    const filteredDeployments = availableDeployments.filter(deployment => {
      if (requireRealtime && !deployment.capabilities.realtime) return false;
      if (requirePrivacy && deployment.capabilities.privacy !== "complete")
        return false;
      if (maxCost === "free" && deployment.capabilities.cost !== "free")
        return false;
      return true;
    });

    if (filteredDeployments.length === 0) {
      throw new Error("No deployments match the requirements");
    }

    // Check health of filtered deployments
    const healthyDeployments = [];
    for (const deployment of filteredDeployments) {
      try {
        const isHealthy = await deployment.healthCheck();
        if (isHealthy) {
          healthyDeployments.push(deployment);
        }
      } catch (error) {
        logger.warn(
          `[DeploymentManager] Health check failed for ${deployment.name}:`,
          error,
        );
      }
    }

    if (healthyDeployments.length === 0) {
      throw new Error("No healthy deployments available");
    }

    // Apply preferences
    if (preferRunPod) {
      const runpodDeployment = healthyDeployments.find(
        d => d.type === "runpod",
      );
      if (runpodDeployment) {
        logger.info(`[DeploymentManager] Using preferred RunPod deployment`);
        return runpodDeployment;
      }
    }

    // Sort by priority (lower number = higher priority)
    healthyDeployments.sort((a, b) => a.priority - b.priority);

    const selectedDeployment = healthyDeployments[0];
    logger.info(
      `[DeploymentManager] Selected deployment: ${selectedDeployment.name}`,
    );

    return selectedDeployment;
  }

  /**
   * Get deployment by type
   */
  getDeployment(type) {
    if (!this.initialized) {
      throw new Error("DeploymentManager not initialized");
    }

    const deployment = this.deployments.get(type);
    if (!deployment) {
      throw new Error(`Deployment type '${type}' not found`);
    }

    return deployment;
  }

  /**
   * Get all available deployments
   */
  getAvailableDeployments() {
    if (!this.initialized) {
      return [];
    }

    return Array.from(this.deployments.values()).map(deployment => ({
      type: deployment.type,
      name: deployment.name,
      capabilities: deployment.capabilities,
      priority: deployment.priority,
    }));
  }

  /**
   * Check local ComfyUI health
   */
  async checkLocalHealth(config) {
    try {
      const baseUrl = config.baseUrl || "http://127.0.0.1:8188";
      // Try the queue endpoint which is more reliable than system_stats
      const response = await fetch(`${baseUrl}/queue`, {
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      logger.debug(`[DeploymentManager] Local health check failed:`, error);
      return false;
    }
  }

  /**
   * Check RunPod health
   */
  async checkRunPodHealth(config) {
    try {
      // For RunPod, we can't easily check health, so return true if config is present
      return !!(config.runPod?.apiKey && config.runPod?.endpointId);
    } catch (error) {
      logger.debug(`[DeploymentManager] RunPod health check failed:`, error);
      return false;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus() {
    if (!this.initialized) {
      return { initialized: false, deployments: [] };
    }

    const status = {
      initialized: true,
      deployments: [],
    };

    for (const [type, deployment] of this.deployments) {
      try {
        const isHealthy = await deployment.healthCheck();
        status.deployments.push({
          type,
          name: deployment.name,
          healthy: isHealthy,
          capabilities: deployment.capabilities,
          priority: deployment.priority,
        });
      } catch (error) {
        status.deployments.push({
          type,
          name: deployment.name,
          healthy: false,
          error: error.message,
          capabilities: deployment.capabilities,
          priority: deployment.priority,
        });
      }
    }

    return status;
  }

  /**
   * Get deployment recommendations based on use case
   */
  getDeploymentRecommendations(useCase) {
    if (!this.initialized) {
      return [];
    }

    const recommendations = [];
    const deployments = Array.from(this.deployments.values());

    switch (useCase) {
      case "development":
        // Prefer local for development
        recommendations.push(
          ...deployments
            .filter(d => d.type === "local")
            .map(d => ({
              ...d,
              reason: "Best for development - free, private, real-time",
            })),
        );
        recommendations.push(
          ...deployments
            .filter(d => d.type === "runpod")
            .map(d => ({ ...d, reason: "Fallback for development" })),
        );
        break;

      case "production":
        // Prefer RunPod for production scalability
        recommendations.push(
          ...deployments
            .filter(d => d.type === "runpod")
            .map(d => ({
              ...d,
              reason: "Best for production - scalable, reliable",
            })),
        );
        recommendations.push(
          ...deployments
            .filter(d => d.type === "local")
            .map(d => ({ ...d, reason: "Cost-effective for production" })),
        );
        break;

      case "privacy":
        // Prefer local for privacy
        recommendations.push(
          ...deployments
            .filter(d => d.capabilities.privacy === "complete")
            .map(d => ({
              ...d,
              reason: "Complete privacy - data never leaves your server",
            })),
        );
        break;

      case "cost":
        // Prefer free options
        recommendations.push(
          ...deployments
            .filter(d => d.capabilities.cost === "free")
            .map(d => ({ ...d, reason: "No usage costs" })),
        );
        break;

      case "scale":
        // Prefer scalable options
        recommendations.push(
          ...deployments
            .filter(d => d.capabilities.scalable)
            .map(d => ({ ...d, reason: "Auto-scaling for high demand" })),
        );
        break;

      default:
        // General recommendations
        recommendations.push(
          ...deployments.map(d => ({
            ...d,
            reason: "Available deployment option",
          })),
        );
    }

    return recommendations;
  }

  /**
   * Reset and reinitialize
   */
  reset() {
    this.deployments.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const deploymentManager = new DeploymentManager();
export default deploymentManager;
