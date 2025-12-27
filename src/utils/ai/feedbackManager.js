import { getDatabaseManager } from "../storage/databaseManager.js";
import { getLogger } from "../logger.js";
import { ActionRowBuilder, ButtonBuilder } from "discord.js";

const logger = getLogger();

/**
 * Feedback Manager - Handles AI feedback collection and learning
 */
export class FeedbackManager {
  /**
   * Record user feedback for an AI response
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID (null for DMs)
   * @param {string} messageId - Discord message ID
   * @param {string} feedbackType - 'positive' or 'negative'
   * @param {string} userMessage - Original user message
   * @param {string} aiResponse - AI's response
   * @param {string} correction - Optional correction text
   * @returns {Promise<boolean>} Success status
   */
  static async recordFeedback(
    userId,
    guildId,
    messageId,
    feedbackType,
    userMessage,
    aiResponse,
    correction = null,
  ) {
    try {
      const db = await getDatabaseManager();
      if (!db || !db.aiFeedback) {
        logger.warn("Database not available for feedback recording");
        return false;
      }

      return await db.aiFeedback.recordFeedback(
        userId,
        guildId,
        messageId,
        feedbackType,
        userMessage,
        aiResponse,
        correction,
      );
    } catch (error) {
      logger.error("Failed to record feedback:", error);
      return false;
    }
  }

  /**
   * Get feedback statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Feedback statistics
   */
  static async getUserFeedbackStats(userId) {
    try {
      const db = await getDatabaseManager();
      if (!db || !db.aiFeedback) {
        return { total: 0, positive: 0, negative: 0 };
      }

      return await db.aiFeedback.getUserFeedbackStats(userId);
    } catch (error) {
      logger.error("Failed to get feedback stats:", error);
      return { total: 0, positive: 0, negative: 0 };
    }
  }
}

// Export singleton instance
export const feedbackManager = new FeedbackManager();

// Cleanup interval for expired feedback contexts in memory
let cleanupInterval = null;

/**
 * Start periodic cleanup of expired feedback contexts in memory
 * This prevents memory leaks from contexts that are never accessed again
 */
export function startFeedbackContextCleanup() {
  if (cleanupInterval) {
    return; // Already started
  }

  // Clean up expired entries every 10 minutes
  cleanupInterval = setInterval(
    () => {
      if (!global.aiFeedbackContext) {
        return;
      }

      const now = Date.now();
      const expiredKeys = [];

      for (const [messageId, context] of global.aiFeedbackContext.entries()) {
        // Remove entries older than 1 hour
        if (now - context.timestamp >= 60 * 60 * 1000) {
          expiredKeys.push(messageId);
        }
      }

      // Remove expired entries
      for (const messageId of expiredKeys) {
        global.aiFeedbackContext.delete(messageId);
      }

      if (expiredKeys.length > 0) {
        logger.debug(
          `Cleaned up ${expiredKeys.length} expired feedback context(s) from memory`,
        );
      }
    },
    10 * 60 * 1000,
  ); // Every 10 minutes

  logger.debug("Started periodic cleanup for feedback contexts");
}

/**
 * Stop periodic cleanup (for testing or graceful shutdown)
 */
export function stopFeedbackContextCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug("Stopped periodic cleanup for feedback contexts");
  }
}

/**
 * Handle AI feedback button interactions
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction
 */
export async function handleAIFeedbackButton(interaction) {
  try {
    const { customId, message } = interaction;
    const logger = getLogger();

    // Defer update immediately to prevent timeout
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    // Extract feedback type from customId
    // Format: ai_feedback_{type}_{interactionId}
    const parts = customId.split("_");
    if (parts.length < 3) {
      await interaction.followUp({
        content: "❌ Invalid feedback button.",
        ephemeral: true,
      });
      return;
    }

    const feedbackType = parts[2]; // 'positive' or 'negative'

    // Get feedback context from database (with memory fallback)
    let feedbackContext = null;

    try {
      const db = await getDatabaseManager();
      if (db && db.aiFeedback) {
        feedbackContext = await db.aiFeedback.getFeedbackContext(message.id);
      }
    } catch (error) {
      logger.debug(
        "Failed to get feedback context from DB, trying memory:",
        error,
      );
    }

    // Fallback to memory cache if database lookup failed
    if (!feedbackContext) {
      feedbackContext = global.aiFeedbackContext?.get(message.id) || null;
    }

    if (!feedbackContext) {
      await interaction.followUp({
        content:
          "❌ Feedback context not found. This feedback may have expired.",
        ephemeral: true,
      });
      return;
    }

    // Record feedback
    const success = await FeedbackManager.recordFeedback(
      feedbackContext.userId,
      feedbackContext.guildId,
      message.id,
      feedbackType,
      feedbackContext.userMessage,
      feedbackContext.aiResponse,
      null, // No correction for simple thumbs up/down
    );

    if (success) {
      // Update button to show feedback was received
      const updatedRow = new ActionRowBuilder().addComponents(
        ...message.components[0].components.map(button => {
          const btn = ButtonBuilder.from(button);
          if (button.customId === customId) {
            btn.setDisabled(true);
            btn.setLabel(feedbackType === "positive" ? "✓ Helpful" : "✓ Noted");
          } else {
            btn.setDisabled(true);
          }
          return btn;
        }),
      );

      await interaction.editReply({
        components: [updatedRow],
      });

      // Send confirmation (ephemeral)
      await interaction.followUp({
        content:
          feedbackType === "positive"
            ? "✅ Thank you for your feedback! This helps improve the AI."
            : "✅ Thank you for your feedback. We'll use this to improve responses.",
        ephemeral: true,
      });

      // Clean up context from memory after successful feedback (DB will auto-expire)
      if (global.aiFeedbackContext?.has(message.id)) {
        global.aiFeedbackContext.delete(message.id);
      }

      logger.info(
        `AI feedback recorded: ${feedbackType} from user ${feedbackContext.userId} for message ${message.id}`,
      );
    } else {
      await interaction.followUp({
        content: "❌ Failed to record feedback. Please try again later.",
        ephemeral: true,
      });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error("Failed to handle AI feedback button:", error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing your feedback.",
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: "❌ An error occurred while processing your feedback.",
          ephemeral: true,
        });
      }
    } catch {
      // Ignore reply errors
    }
  }
}
