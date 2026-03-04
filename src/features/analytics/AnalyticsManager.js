import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";

/**
 * Analytics Manager for tracking server growth and activity history
 */
class AnalyticsManager {
  constructor() {
    this.logger = getLogger();
    this.storageManager = null;
    this.isInitialized = false;
    this.saveInterval = null;
    this.batchInterval = null;
    this.batch = {}; // guildId:dateKey -> { type: amount }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.storageManager = await getStorageManager();
      this.isInitialized = true;
      this.logger.info("📈 Analytics Manager initialized");

      // Auto-save data every 30 minutes just in case
      this.saveInterval = setInterval(
        () => this.cleanupOldData(),
        24 * 60 * 60 * 1000,
      ).unref();

      // Flush batch every 1 minute to prevent database spam
      this.batchInterval = setInterval(
        () => this.flushBatch(),
        60 * 1000,
      ).unref();
    } catch (error) {
      this.logger.error("Failed to initialize Analytics Manager", error);
      throw error;
    }
  }

  /**
   * Get the current date key in YYYY-MM-DD format
   */
  getDateKey() {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Record a member joining a guild
   */
  async recordJoin(guildId) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "joins", 1);
  }

  /**
   * Record a member leaving a guild
   */
  async recordLeave(guildId) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "leaves", 1);
  }

  /**
   * Record a message sent in a guild
   */
  async recordMessage(guildId) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "messages", 1);
  }

  /**
   * Record voice activity minutes in a guild
   */
  async recordVoiceMinutes(guildId, minutes) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "voiceMinutes", minutes);
  }

  /**
   * Record a command used in a guild
   */
  async recordCommand(guildId) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "commands", 1);
  }

  /**
   * Record a role reaction event in a guild
   */
  async recordRoleReaction(guildId) {
    await this.initialize();
    const dateKey = this.getDateKey();
    await this.updateCounter(guildId, dateKey, "roleReactions", 1);
  }

  /**
   * Update a specific counter in the storage (Batched)
   */
  async updateCounter(guildId, dateKey, type, amount) {
    try {
      const key = `${guildId}:${dateKey}`;
      if (!this.batch[key]) {
        this.batch[key] = {};
      }
      this.batch[key][type] = (this.batch[key][type] || 0) + amount;
    } catch (error) {
      this.logger.error(
        `Error queueing analytics counter for ${guildId}:`,
        error,
      );
    }
  }

  /**
   * Flush all batched analytics to the database
   */
  async flushBatch() {
    if (Object.keys(this.batch).length === 0) return;

    const currentBatch = { ...this.batch };
    this.batch = {};

    for (const [key, data] of Object.entries(currentBatch)) {
      const [guildId, dateKey] = key.split(":");
      for (const [type, amount] of Object.entries(data)) {
        try {
          await this.storageManager.updateGuildAnalytics(
            guildId,
            dateKey,
            type,
            amount,
          );
        } catch (error) {
          this.logger.error(
            `Error flushing analytics counter for ${guildId}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Get historical data for a guild (default last 30 days)
   */
  async getHistory(guildId, days = 30) {
    await this.initialize();
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));

    const startDate = start.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    try {
      const history = await this.storageManager.getGuildAnalyticsHistory(
        guildId,
        startDate,
        endDate,
      );

      return history.map(h => {
        const date = new Date(h.date);
        return {
          date: h.date,
          label: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          joins: h.joins,
          leaves: h.leaves,
          members: h.members || 0,
          messages: h.messages || 0,
          voiceMinutes: h.voiceMinutes || 0,
          commands: h.commands || 0,
          roleReactions: h.roleReactions || 0,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting analytics history for ${guildId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Cleanup data older than 90 days to save space
   */
  async cleanupOldData() {
    try {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 90);
      const cutoffKey = cutoff.toISOString().split("T")[0];

      const deletedCount =
        await this.storageManager.cleanupOldAnalytics(cutoffKey);
      if (deletedCount > 0) {
        this.logger.info(`🧹 Cleaned up ${deletedCount} old analytics records`);
      }
    } catch (error) {
      this.logger.error("Error cleaning up old analytics data:", error);
    }
  }
}

let analyticsManager = null;

export async function getAnalyticsManager() {
  if (!analyticsManager) {
    analyticsManager = new AnalyticsManager();
    await analyticsManager.initialize();
  }
  return analyticsManager;
}
