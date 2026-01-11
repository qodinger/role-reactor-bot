/**
 * ComfyUI Job Recovery System
 * Handles recovery of interrupted ComfyUI jobs
 */

import { getLogger } from "../../../logger.js";
import fs from "fs/promises";
import path from "path";

const logger = getLogger();

export class JobRecovery {
  constructor() {
    this.jobsFile = path.join(process.cwd(), "data", "comfyui_jobs.json");
    this.jobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize job recovery system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.jobsFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Load existing jobs
      await this.loadJobs();
      
      this.initialized = true;
      logger.info(`[JobRecovery] Initialized with ${this.jobs.size} tracked jobs`);
    } catch (error) {
      logger.error(`[JobRecovery] Failed to initialize:`, error);
      throw error;
    }
  }

  /**
   * Load jobs from disk
   */
  async loadJobs() {
    try {
      const data = await fs.readFile(this.jobsFile, "utf8");
      const jobsArray = JSON.parse(data);
      
      this.jobs.clear();
      for (const job of jobsArray) {
        this.jobs.set(job.promptId, {
          ...job,
          startTime: new Date(job.startTime),
          lastCheck: job.lastCheck ? new Date(job.lastCheck) : null,
        });
      }
      
      logger.info(`[JobRecovery] Loaded ${this.jobs.size} jobs from disk`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.warn(`[JobRecovery] Failed to load jobs:`, error);
      }
      // File doesn't exist yet, start with empty jobs
      this.jobs.clear();
    }
  }

  /**
   * Save jobs to disk
   */
  async saveJobs() {
    try {
      const jobsArray = Array.from(this.jobs.values()).map(job => ({
        ...job,
        startTime: job.startTime.toISOString(),
        lastCheck: job.lastCheck ? job.lastCheck.toISOString() : null,
      }));
      
      await fs.writeFile(this.jobsFile, JSON.stringify(jobsArray, null, 2));
    } catch (error) {
      logger.error(`[JobRecovery] Failed to save jobs:`, error);
    }
  }

  /**
   * Track a new job
   */
  async trackJob(promptId, jobInfo) {
    await this.initialize();

    const job = {
      promptId,
      userId: jobInfo.userId,
      guildId: jobInfo.guildId,
      channelId: jobInfo.channelId,
      interactionId: jobInfo.interactionId,
      prompt: jobInfo.prompt,
      model: jobInfo.model,
      workflow: jobInfo.workflow,
      startTime: new Date(),
      lastCheck: null,
      status: "running",
      retryCount: 0,
    };

    this.jobs.set(promptId, job);
    await this.saveJobs();

    logger.info(`[JobRecovery] Tracking job ${promptId} for user ${jobInfo.userId}`);
  }

  /**
   * Update job status
   */
  async updateJob(promptId, updates) {
    const job = this.jobs.get(promptId);
    if (!job) return false;

    Object.assign(job, updates, { lastCheck: new Date() });
    await this.saveJobs();

    return true;
  }

  /**
   * Complete and remove job
   */
  async completeJob(promptId) {
    const job = this.jobs.get(promptId);
    if (!job) return false;

    this.jobs.delete(promptId);
    await this.saveJobs();

    logger.info(`[JobRecovery] Completed job ${promptId}`);
    return true;
  }

  /**
   * Get job by prompt ID
   */
  getJob(promptId) {
    return this.jobs.get(promptId);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId) {
    return Array.from(this.jobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Get all running jobs
   */
  getRunningJobs() {
    return Array.from(this.jobs.values()).filter(job => job.status === "running");
  }

  /**
   * Get orphaned jobs (running for too long without updates)
   */
  getOrphanedJobs(maxAge = 5 * 60 * 1000) { // 5 minutes default (reduced from 30 minutes)
    const now = new Date();
    return Array.from(this.jobs.values()).filter(job => {
      if (job.status !== "running") return false;
      
      const checkTime = job.lastCheck || job.startTime;
      return (now - checkTime) > maxAge;
    });
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = new Date();
    let cleaned = 0;

    for (const [promptId, job] of this.jobs.entries()) {
      if (job.status === "completed" || job.status === "failed") {
        const age = now - (job.lastCheck || job.startTime);
        if (age > maxAge) {
          this.jobs.delete(promptId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      await this.saveJobs();
      logger.info(`[JobRecovery] Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }

  /**
   * Check ComfyUI for job status
   */
  async checkJobStatus(promptId, comfyuiBaseUrl) {
    try {
      // Check if job is in queue
      const queueResponse = await fetch(`${comfyuiBaseUrl}/queue`);
      const queueData = await queueResponse.json();
      
      // Check running queue
      const isRunning = queueData.queue_running.some(item => 
        item[1] === promptId || item[0] === promptId
      );
      
      if (isRunning) {
        return { status: "running", inQueue: true };
      }

      // Check pending queue
      const isPending = queueData.queue_pending.some(item => 
        item[1] === promptId || item[0] === promptId
      );
      
      if (isPending) {
        return { status: "pending", inQueue: true };
      }

      // Check history for completion
      const historyResponse = await fetch(`${comfyuiBaseUrl}/history/${promptId}`);
      const historyData = await historyResponse.json();
      
      if (historyData[promptId]) {
        return { 
          status: "completed", 
          inQueue: false, 
          result: historyData[promptId] 
        };
      }

      // Job not found anywhere - likely failed or cancelled
      return { status: "not_found", inQueue: false };

    } catch (error) {
      logger.error(`[JobRecovery] Failed to check job status for ${promptId}:`, error);
      return { status: "error", error: error.message };
    }
  }

  /**
   * Recover all orphaned jobs
   */
  async recoverOrphanedJobs(comfyuiProvider) {
    await this.initialize();

    const orphanedJobs = this.getOrphanedJobs();
    if (orphanedJobs.length === 0) {
      logger.info(`[JobRecovery] No orphaned jobs found`);
      return [];
    }

    logger.info(`[JobRecovery] Found ${orphanedJobs.length} orphaned jobs, checking status...`);

    const recoveredJobs = [];

    for (const job of orphanedJobs) {
      try {
        const status = await this.checkJobStatus(job.promptId, comfyuiProvider.baseUrl);
        
        await this.updateJob(job.promptId, { 
          status: status.status,
          lastCheck: new Date() 
        });

        if (status.status === "completed" && status.result) {
          // Job completed! Try to extract and send the image
          const images = await comfyuiProvider.getGenerationResults(job.promptId);
          if (images && images.length > 0) {
            recoveredJobs.push({
              job,
              images,
              status: "recovered"
            });
          }
        } else if (status.status === "not_found") {
          // Job disappeared, mark as failed
          await this.updateJob(job.promptId, { status: "failed" });
        }

      } catch (error) {
        logger.error(`[JobRecovery] Failed to recover job ${job.promptId}:`, error);
        await this.updateJob(job.promptId, { 
          status: "error",
          error: error.message 
        });
      }
    }

    logger.info(`[JobRecovery] Recovered ${recoveredJobs.length} completed jobs`);
    return recoveredJobs;
  }

  /**
   * Get recovery statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    
    return {
      total: jobs.length,
      running: jobs.filter(j => j.status === "running").length,
      pending: jobs.filter(j => j.status === "pending").length,
      completed: jobs.filter(j => j.status === "completed").length,
      failed: jobs.filter(j => j.status === "failed").length,
      error: jobs.filter(j => j.status === "error").length,
      orphaned: this.getOrphanedJobs().length,
    };
  }
}

// Export singleton instance
export const jobRecovery = new JobRecovery();
export default jobRecovery;