import { getStorageManager } from "../../../../utils/storage/storageManager.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

// Auto cleanup configuration
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_RETENTION_DAYS = 7;

// Start automatic cleanup
let cleanupInterval = null;

/**
 * Generation history tracking for debugging and support
 * Stores in flat format similar to imagine_jobs.json
 */
export class GenerationHistory {
  /**
   * Record a generation attempt
   * @param {string} userId - User ID
   * @param {Object} generationData - Generation details
   * @returns {Promise<void>}
   */
  static async recordGeneration(userId, generationData) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_jobs")) || {};

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const jobId = `avatar_${timestamp}_${randomId}`;

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const record = {
      prompt: generationData.prompt,
      userId,
      provider: generationData.provider || null,
      model: generationData.model || null,
      config: generationData.config || {},
      success: generationData.success,
      error: generationData.error || null,
      processingTime: generationData.processingTime || 0,
      userTier: generationData.userTier || "Regular",
      createdAt,
      expiresAt,
    };

    history[jobId] = record;
    await storage.set("avatar_jobs", history);

    logger.debug(
      `Recorded generation ${jobId} for user ${userId}: ${generationData.success ? "SUCCESS" : "FAILED"}`,
    );
  }

  /**
   * Get generation history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recent generations to return
   * @returns {Promise<Array>} User generation history
   */
  static async getUserHistory(userId, limit = 20) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_jobs")) || {};

    const userGenerations = Object.entries(history)
      .filter(([_, record]) => record.userId === userId)
      .map(([jobId, record]) => ({
        jobId,
        ...record,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return userGenerations;
  }

  /**
   * Get failed generations for debugging
   * @param {number} hours - Hours to look back
   * @returns {Promise<Array>} Failed generations
   */
  static async getFailedGenerations(hours = 24) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_jobs")) || {};

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const failedGenerations = [];

    for (const [jobId, record] of Object.entries(history)) {
      if (!record.success && new Date(record.createdAt) > cutoffTime) {
        failedGenerations.push({
          jobId,
          ...record,
        });
      }
    }

    return failedGenerations.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }

  /**
   * Get generation statistics
   * @param {number} hours - Hours to look back
   * @returns {Promise<Object>} Generation statistics
   */
  static async getGenerationStats(hours = 24) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_jobs")) || {};

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let totalAttempts = 0;
    let successfulGenerations = 0;
    let failedGenerations = 0;
    let averageProcessingTime = 0;
    const processingTimes = [];

    for (const record of Object.values(history)) {
      if (new Date(record.createdAt) > cutoffTime) {
        totalAttempts += 1;
        if (record.success) {
          successfulGenerations += 1;
        } else {
          failedGenerations += 1;
        }

        if (record.processingTime > 0) {
          processingTimes.push(record.processingTime);
        }
      }
    }

    if (processingTimes.length > 0) {
      averageProcessingTime =
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    }

    return {
      timeRange: `${hours} hours`,
      totalAttempts,
      successfulGenerations,
      failedGenerations,
      successRate:
        totalAttempts > 0
          ? ((successfulGenerations / totalAttempts) * 100).toFixed(2)
          : 0,
      averageProcessingTime: Math.round(averageProcessingTime),
      failureRate:
        totalAttempts > 0
          ? ((failedGenerations / totalAttempts) * 100).toFixed(2)
          : 0,
    };
  }

  /**
   * Clean up old generation history
   * @param {number} daysToKeep - Days of history to keep
   * @returns {Promise<number>} Number of records cleaned up
   */
  static async cleanupOldHistory(daysToKeep = 7) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_jobs")) || {};

    const now = new Date();
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let totalCleaned = 0;

    for (const [jobId, record] of Object.entries(history)) {
      let shouldDelete = false;

      // Priority 1: Check if expiresAt is set and in the past
      if (record.expiresAt) {
        const expiresAt = new Date(record.expiresAt);
        if (expiresAt < now) {
          shouldDelete = true;
        }
      }
      // Priority 2: Fallback to createdAt for old records without expiresAt
      else if (record.createdAt) {
        const createdAt = new Date(record.createdAt);
        if (createdAt < cutoffTime) {
          shouldDelete = true;
        }
      }
      // Priority 3: Delete records with no timestamp (invalid data)
      else {
        shouldDelete = true;
      }

      if (shouldDelete) {
        delete history[jobId];
        totalCleaned += 1;
      }
    }

    await storage.set("avatar_jobs", history);
    logger.info(`Cleaned up ${totalCleaned} old generation records`);
    return totalCleaned;
  }

  /**
   * Start automatic cleanup process
   * @param {number} retentionDays - Days to keep (default: 7)
   */
  static startAutoCleanup(retentionDays = DEFAULT_RETENTION_DAYS) {
    // Stop existing cleanup if running
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }

    // Calculate next cleanup time (2 AM today or tomorrow)
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(2, 0, 0, 0); // 2:00 AM

    if (nextCleanup <= now) {
      nextCleanup.setDate(nextCleanup.getDate() + 1); // Tomorrow 2 AM
    }

    const timeUntilCleanup = nextCleanup.getTime() - now.getTime();

    logger.info(
      `Auto cleanup scheduled for ${nextCleanup.toLocaleString()} (${retentionDays} days retention)`,
    );

    // Set initial timeout for 2 AM
    setTimeout(() => {
      // Run cleanup
      this.runAutoCleanup(retentionDays);

      // Set up daily interval
      cleanupInterval = setInterval(() => {
        this.runAutoCleanup(retentionDays);
      }, CLEANUP_INTERVAL);
    }, timeUntilCleanup);
  }

  /**
   * Stop automatic cleanup process
   */
  static stopAutoCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      logger.info("Auto cleanup stopped");
    }
  }

  /**
   * Run automatic cleanup with logging
   * @param {number} retentionDays - Days to keep
   * @private
   */
  static async runAutoCleanup(retentionDays) {
    try {
      logger.info(
        `Starting automatic cleanup (keeping ${retentionDays} days of history)`,
      );
      const cleanedCount = await this.cleanupOldHistory(retentionDays);
      logger.info(
        `Auto cleanup completed: removed ${cleanedCount} old records`,
      );
    } catch (error) {
      logger.error("Auto cleanup failed:", error);
    }
  }

  /**
   * Get cleanup status
   * @returns {Object} Cleanup status information
   */
  static getCleanupStatus() {
    return {
      isRunning: cleanupInterval !== null,
      interval: CLEANUP_INTERVAL,
      nextCleanup: cleanupInterval ? "Running daily at 2 AM" : "Not running",
      retentionDays: DEFAULT_RETENTION_DAYS,
    };
  }
}
