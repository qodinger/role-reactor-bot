import { BaseRepository } from "./BaseRepository.js";

export class AIFeedbackRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "ai_feedback", cache, logger);
  }

  /**
   * Record user feedback for an AI response
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID (null for DMs)
   * @param {string} messageId - Discord message ID of the AI response
   * @param {string} feedbackType - 'positive' or 'negative'
   * @param {string} userMessage - Original user message
   * @param {string} aiResponse - AI's response
   * @param {string} correction - Optional correction text from user
   * @returns {Promise<boolean>} Success status
   */
  async recordFeedback(
    userId,
    guildId,
    messageId,
    feedbackType,
    userMessage,
    aiResponse,
    correction = null,
  ) {
    try {
      const feedback = {
        userId,
        guildId: guildId || null,
        messageId,
        feedbackType, // 'positive' or 'negative'
        userMessage,
        aiResponse,
        correction,
        timestamp: new Date(),
      };

      await this.collection.insertOne(feedback);

      // Invalidate user feedback cache
      this.cache.delete(`feedback_user_${userId}`);
      this.cache.delete(`feedback_guild_${guildId || "dm"}`);
      this.cache.delete(`feedback_stats_${userId}`);

      return true;
    } catch (error) {
      this.logger.error("Failed to record AI feedback:", error);
      return false;
    }
  }

  /**
   * Get user's feedback history
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of feedback entries to return
   * @returns {Promise<Array>} Array of feedback entries
   */
  async getUserFeedback(userId, limit = 50) {
    try {
      const cacheKey = `feedback_user_${userId}_${limit}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const feedback = await this.collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      this.cache.set(cacheKey, feedback);
      return feedback;
    } catch (error) {
      this.logger.error(`Failed to get feedback for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get feedback statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Feedback statistics
   */
  async getUserFeedbackStats(userId) {
    try {
      const cacheKey = `feedback_stats_${userId}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const allFeedback = await this.collection.find({ userId }).toArray();
      const stats = {
        total: allFeedback.length,
        positive: allFeedback.filter(f => f.feedbackType === "positive").length,
        negative: allFeedback.filter(f => f.feedbackType === "negative").length,
      };

      this.cache.set(cacheKey, stats);
      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get feedback stats for user ${userId}:`,
        error,
      );
      return { total: 0, positive: 0, negative: 0 };
    }
  }

  /**
   * Store feedback context for a message (for button handlers)
   * @param {string} messageId - Discord message ID
   * @param {Object} context - Feedback context { userId, guildId, userMessage, aiResponse, timestamp }
   * @returns {Promise<boolean>} Success status
   */
  async setFeedbackContext(messageId, context) {
    try {
      // Use a separate collection for feedback contexts (TTL index will auto-delete after 1 hour)
      const contextCollection = this.db.collection("ai_feedback_contexts");
      // Use upsert to handle duplicate messageIds (shouldn't happen, but safer)
      await contextCollection.updateOne(
        { messageId },
        {
          $set: {
            messageId,
            ...context,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
          },
        },
        { upsert: true },
      );

      // Also cache in memory for quick access
      if (!global.aiFeedbackContext) {
        global.aiFeedbackContext = new Map();
      }
      global.aiFeedbackContext.set(messageId, context);

      return true;
    } catch (error) {
      this.logger.error("Failed to store feedback context:", error);
      return false;
    }
  }

  /**
   * Get feedback context for a message
   * @param {string} messageId - Discord message ID
   * @returns {Promise<Object|null>} Feedback context or null
   */
  async getFeedbackContext(messageId) {
    try {
      // Try memory cache first
      if (global.aiFeedbackContext?.has(messageId)) {
        const context = global.aiFeedbackContext.get(messageId);
        // Check if expired (1 hour)
        if (Date.now() - context.timestamp < 60 * 60 * 1000) {
          return context;
        }
        // Remove expired entry
        global.aiFeedbackContext.delete(messageId);
      }

      // Fall back to database
      const contextCollection = this.db.collection("ai_feedback_contexts");
      const doc = await contextCollection.findOne({ messageId });

      if (doc) {
        const context = {
          userId: doc.userId,
          guildId: doc.guildId,
          userMessage: doc.userMessage,
          aiResponse: doc.aiResponse,
          timestamp: doc.timestamp || doc.createdAt?.getTime() || Date.now(),
        };

        // Cache in memory
        if (!global.aiFeedbackContext) {
          global.aiFeedbackContext = new Map();
        }
        global.aiFeedbackContext.set(messageId, context);

        return context;
      }

      return null;
    } catch (error) {
      this.logger.error("Failed to get feedback context:", error);
      return null;
    }
  }
}
