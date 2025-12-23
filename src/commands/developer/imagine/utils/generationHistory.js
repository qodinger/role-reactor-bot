import { getImageJobsStorageManager } from "../../../../utils/storage/imageJobsStorageManager.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

// Auto cleanup configuration
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_RETENTION_DAYS =
  parseInt(process.env.AI_IMAGE_JOBS_RETENTION_DAYS) || 7;

// Start automatic cleanup
let cleanupInterval = null;

const COLLECTION_NAME = "imagine_jobs";

/**
 * Generation history tracking for imagine command
 * Stores in flat format similar to avatar_jobs.json
 */
export class ImagineGenerationHistory {
  /**
   * Record a generation attempt
   * @param {string} userId - User ID
   * @param {Object} generationData - Generation details
   * @returns {Promise<void>}
   */
  static async recordGeneration(userId, generationData) {
    const storage = getImageJobsStorageManager();

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const jobId = `imagine_${timestamp}_${randomId}`;

    const createdAt = new Date().toISOString();
    // Only set expiresAt if retention is enabled (positive number)
    // If disabled (0 or negative), set to far future date (effectively never expires)
    const expiresAt =
      DEFAULT_RETENTION_DAYS > 0
        ? new Date(
            Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString()
        : new Date("2099-12-31T23:59:59.999Z").toISOString();

    const record = {
      prompt: generationData.prompt,
      userId,
      provider: generationData.provider || null,
      model: generationData.model || null,
      config: generationData.config || {},
      createdAt,
      expiresAt,
    };

    await storage.save(COLLECTION_NAME, jobId, record);

    logger.debug(`Recorded imagine generation ${jobId} for user ${userId}`);
  }

  /**
   * Get generation history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recent generations to return
   * @returns {Promise<Array>} User generation history
   */
  static async getUserHistory(userId, limit = 20) {
    const storage = getImageJobsStorageManager();
    return await storage.getByUserId(COLLECTION_NAME, userId, limit);
  }

  /**
   * Get generation statistics
   * @param {number} hours - Hours to look back
   * @returns {Promise<Object>} Generation statistics
   */
  static async getGenerationStats(hours = 24) {
    const storage = getImageJobsStorageManager();
    const history = await storage.getAll(COLLECTION_NAME);

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let totalGenerations = 0;

    for (const record of Object.values(history)) {
      if (new Date(record.createdAt) > cutoffTime) {
        totalGenerations += 1;
      }
    }

    return {
      timeRange: `${hours} hours`,
      totalGenerations,
    };
  }

  /**
   * Delete all generation history for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of records deleted
   */
  static async deleteUserHistory(userId) {
    const storage = getImageJobsStorageManager();
    const deletedCount = await storage.deleteByUserId(COLLECTION_NAME, userId);
    logger.info(
      `Deleted ${deletedCount} imagine generation records for user ${userId}`,
    );
    return deletedCount;
  }

  /**
   * Clean up old generation history
   * @param {number} daysToKeep - Days of history to keep (0 or negative = disable cleanup)
   * @returns {Promise<number>} Number of records cleaned up
   */
  static async cleanupOldHistory(daysToKeep = 7) {
    // Disable cleanup if daysToKeep is 0 or negative
    if (daysToKeep <= 0) {
      logger.debug("Auto-cleanup disabled (retention set to 0 or negative)");
      return 0;
    }

    const storage = getImageJobsStorageManager();
    const totalCleaned = await storage.cleanup(COLLECTION_NAME, daysToKeep);
    logger.info(`Cleaned up ${totalCleaned} old imagine generation records`);
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
