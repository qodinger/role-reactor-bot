import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { getStorageManager } from "../../storage/storageManager.js";

const logger = getLogger();

/**
 * Manages storage and retrieval of conversation summaries
 * Supports both MongoDB and file storage
 */
export class SummaryStorage {
  constructor() {
    this.dbManager = null;
    this.storageManager = null;
    this.storageType = process.env.AI_CONVERSATION_STORAGE_TYPE || "file";
    this.summaries = new Map(); // In-memory cache
  }

  /**
   * Initialize storage backend
   */
  async initialize() {
    if (this.storageType === "file") {
      try {
        this.storageManager = await getStorageManager();
        logger.debug("Summary storage initialized (file)");
      } catch (error) {
        logger.debug("Failed to initialize file storage for summaries:", error);
      }
    } else if (this.storageType === "mongodb") {
      try {
        this.dbManager = await getDatabaseManager();
        if (this.dbManager && this.dbManager.conversations) {
          logger.debug("Summary storage initialized (MongoDB)");
        }
      } catch (error) {
        logger.debug("Failed to initialize MongoDB for summaries:", error);
      }
    }
  }

  /**
   * Get conversation key
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {string} Conversation key
   */
  getKey(userId, guildId = null) {
    if (!guildId) {
      return `summary_dm_${userId}`;
    }
    return `summary_${userId}_${guildId}`;
  }

  /**
   * Load summary from storage
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {Promise<string|null>} Summary or null if not found
   */
  async loadSummary(userId, guildId = null) {
    const key = this.getKey(userId, guildId);

    // Check cache first
    if (this.summaries.has(key)) {
      return this.summaries.get(key);
    }

    // Try to load from storage
    try {
      if (this.storageType === "file" && this.storageManager) {
        const summaries =
          (await this.storageManager.read("ai_conversation_summaries")) || {};
        const summaryKey = guildId ? `${userId}_${guildId}` : `dm_${userId}`;
        const data = summaries[summaryKey];
        if (data && data.summary) {
          this.summaries.set(key, data.summary);
          return data.summary;
        }
      } else if (
        this.storageType === "mongodb" &&
        this.dbManager?.conversations
      ) {
        const conversation = await this.dbManager.conversations.getByUser(
          userId,
          guildId,
        );
        if (conversation && conversation.summary) {
          this.summaries.set(key, conversation.summary);
          return conversation.summary;
        }
      }
    } catch (error) {
      logger.debug("Failed to load summary from storage:", error);
    }

    return null;
  }

  /**
   * Save summary to storage
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @param {string} summary - Summary text
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveSummary(userId, guildId, summary) {
    if (!summary || summary.trim().length === 0) {
      return false;
    }

    const key = this.getKey(userId, guildId);

    // Update cache
    this.summaries.set(key, summary);

    // Save to storage (async, don't wait)
    try {
      if (this.storageType === "file" && this.storageManager) {
        const summaries =
          (await this.storageManager.read("ai_conversation_summaries")) || {};
        const summaryKey = guildId ? `${userId}_${guildId}` : `dm_${userId}`;
        summaries[summaryKey] = {
          userId,
          guildId: guildId || null,
          summary,
          updatedAt: Date.now(),
        };
        await this.storageManager.write("ai_conversation_summaries", summaries);
      } else if (
        this.storageType === "mongodb" &&
        this.dbManager?.conversations
      ) {
        // Update conversation document with summary
        const conversation = await this.dbManager.conversations.getByUser(
          userId,
          guildId,
        );
        if (conversation) {
          // Update existing conversation with summary
          await this.dbManager.conversations.collection.updateOne(
            { userId, guildId: guildId || null },
            { $set: { summary, summaryUpdatedAt: new Date() } },
          );
        } else {
          // Create new conversation document with summary
          await this.dbManager.conversations.save(
            userId,
            guildId,
            [],
            Date.now(),
          );
          await this.dbManager.conversations.collection.updateOne(
            { userId, guildId: guildId || null },
            { $set: { summary, summaryUpdatedAt: new Date() } },
          );
        }
      }
      return true;
    } catch (error) {
      logger.debug("Failed to save summary to storage:", error);
      // Don't throw - cache is updated, storage failure is non-critical
      return false;
    }
  }

  /**
   * Delete summary
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteSummary(userId, guildId = null) {
    const key = this.getKey(userId, guildId);
    this.summaries.delete(key);

    try {
      if (this.storageType === "file" && this.storageManager) {
        const summaries =
          (await this.storageManager.read("ai_conversation_summaries")) || {};
        const summaryKey = guildId ? `${userId}_${guildId}` : `dm_${userId}`;
        delete summaries[summaryKey];
        await this.storageManager.write("ai_conversation_summaries", summaries);
      } else if (
        this.storageType === "mongodb" &&
        this.dbManager?.conversations
      ) {
        await this.dbManager.conversations.collection.updateOne(
          { userId, guildId: guildId || null },
          { $unset: { summary: "", summaryUpdatedAt: "" } },
        );
      }
      return true;
    } catch (error) {
      logger.debug("Failed to delete summary from storage:", error);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.summaries.clear();
  }
}
