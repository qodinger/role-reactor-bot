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
   * Update a specific counter in the storage
   */
  async updateCounter(guildId, dateKey, type, amount) {
    try {
      const data = (await this.storageManager.read("guild_analytics")) || {};

      if (!data[guildId]) data[guildId] = {};
      if (!data[guildId][dateKey]) {
        data[guildId][dateKey] = { joins: 0, leaves: 0, members: 0 };
      }

      data[guildId][dateKey][type] += amount;

      // Also update current member count snapshot if possible
      // This will be handled more accurately by the scheduled daily snapshot

      await this.storageManager.write("guild_analytics", data);
    } catch (error) {
      this.logger.error(
        `Error updating analytics counter for ${guildId}:`,
        error,
      );
    }
  }

  /**
   * Get historical data for a guild (default last 30 days)
   */
  async getHistory(guildId, days = 30) {
    await this.initialize();
    const data = (await this.storageManager.read("guild_analytics")) || {};
    const guildData = data[guildId] || {};

    const history = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];

      const dayData = guildData[dateKey] || { joins: 0, leaves: 0, members: 0 };

      history.push({
        date: dateKey,
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        joins: dayData.joins,
        leaves: dayData.leaves,
      });
    }

    return history;
  }

  /**
   * Cleanup data older than 90 days to save space
   */
  async cleanupOldData() {
    try {
      const data = (await this.storageManager.read("guild_analytics")) || {};
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 90);
      const cutoffKey = cutoff.toISOString().split("T")[0];

      let modified = false;
      for (const guildId in data) {
        for (const dateKey in data[guildId]) {
          if (dateKey < cutoffKey) {
            delete data[guildId][dateKey];
            modified = true;
          }
        }
      }

      if (modified) {
        await this.storageManager.write("guild_analytics", data);
        this.logger.info("🧹 Cleaned up old analytics data");
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
