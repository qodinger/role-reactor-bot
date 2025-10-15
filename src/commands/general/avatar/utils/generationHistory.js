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
    const history = (await storage.get("avatar_generation_history")) || {};

    if (!history[userId]) {
      history[userId] = {
        generations: [],
        totalAttempts: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    const userHistory = history[userId];
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const record = {
      id: generationId,
      timestamp: new Date().toISOString(),
      prompt: generationData.prompt,
      success: generationData.success,
      error: generationData.error || null,
      processingTime: generationData.processingTime || 0,
      userTier: generationData.userTier || "Regular",
    };

    userHistory.generations.push(record);
    userHistory.totalAttempts += 1;

    if (generationData.success) {
      userHistory.successfulGenerations += 1;
    } else {
      userHistory.failedGenerations += 1;
    }

    userHistory.lastUpdated = new Date().toISOString();

    // Keep only last 50 generations per user to prevent storage bloat
    if (userHistory.generations.length > 50) {
      userHistory.generations = userHistory.generations.slice(-50);
    }

    history[userId] = userHistory;
    await storage.set("avatar_generation_history", history);

    logger.debug(
      `Recorded generation ${generationId} for user ${userId}: ${generationData.success ? "SUCCESS" : "FAILED"}`,
    );
  }

  /**
   * Get generation history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recent generations to return
   * @returns {Promise<Object|null>} User generation history
   */
  static async getUserHistory(userId, limit = 20) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_generation_history")) || {};

    if (!history[userId]) {
      return null;
    }

    const userHistory = history[userId];
    const recentGenerations = userHistory.generations.slice(-limit);

    return {
      ...userHistory,
      generations: recentGenerations,
    };
  }

  /**
   * Get failed generations for debugging
   * @param {number} hours - Hours to look back
   * @returns {Promise<Array>} Failed generations
   */
  static async getFailedGenerations(hours = 24) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_generation_history")) || {};

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const failedGenerations = [];

    for (const [userId, userHistory] of Object.entries(history)) {
      const recentFailures = userHistory.generations.filter(
        gen => !gen.success && new Date(gen.timestamp) > cutoffTime,
      );

      failedGenerations.push(
        ...recentFailures.map(gen => ({
          ...gen,
          userId,
        })),
      );
    }

    return failedGenerations.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );
  }

  /**
   * Get generation statistics
   * @param {number} hours - Hours to look back
   * @returns {Promise<Object>} Generation statistics
   */
  static async getGenerationStats(hours = 24) {
    const storage = await getStorageManager();
    const history = (await storage.get("avatar_generation_history")) || {};

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let totalAttempts = 0;
    let successfulGenerations = 0;
    let failedGenerations = 0;
    let averageProcessingTime = 0;
    const processingTimes = [];

    for (const userHistory of Object.values(history)) {
      const recentGenerations = userHistory.generations.filter(
        gen => new Date(gen.timestamp) > cutoffTime,
      );

      totalAttempts += recentGenerations.length;
      successfulGenerations += recentGenerations.filter(
        gen => gen.success,
      ).length;
      failedGenerations += recentGenerations.filter(gen => !gen.success).length;

      processingTimes.push(
        ...recentGenerations
          .filter(gen => gen.processingTime > 0)
          .map(gen => gen.processingTime),
      );
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
    const history = (await storage.get("avatar_generation_history")) || {};

    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let totalCleaned = 0;

    for (const [userId, userHistory] of Object.entries(history)) {
      const originalLength = userHistory.generations.length;
      userHistory.generations = userHistory.generations.filter(
        gen => new Date(gen.timestamp) > cutoffTime,
      );

      const cleaned = originalLength - userHistory.generations.length;
      totalCleaned += cleaned;

      if (userHistory.generations.length === 0) {
        delete history[userId];
      } else {
        // Update statistics
        userHistory.totalAttempts = userHistory.generations.length;
        userHistory.successfulGenerations = userHistory.generations.filter(
          gen => gen.success,
        ).length;
        userHistory.failedGenerations = userHistory.generations.filter(
          gen => !gen.success,
        ).length;
        userHistory.lastUpdated = new Date().toISOString();
      }
    }

    await storage.set("avatar_generation_history", history);
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
