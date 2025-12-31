import { getLogger } from "../../logger.js";
import { ConversationSummarizer } from "./summarizer.js";
import { SummaryStorage } from "./summaryStorage.js";

const logger = getLogger();

/**
 * Manages conversation memory using summarization
 * Combines recent messages with summarized older conversations
 */
export class MemoryManager {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
    this.summarizer = new ConversationSummarizer();
    this.summaryStorage = new SummaryStorage();
    // Optimal defaults: Enabled, keep last 5 messages, summarize after 10 messages
    this.enabled = true;
    this.recentMessageCount = 5; // Keep last 5 messages in full
    this.summarizationThreshold = 10; // Create summary after 10 messages

    // Initialize storage
    this.summaryStorage.initialize().catch(error => {
      logger.debug("Failed to initialize summary storage:", error);
    });
  }

  /**
   * Get conversation context with summarization
   * Returns: [summary message (if exists), ...recent messages]
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {Promise<Array>} Array of message objects for AI context
   */
  async getConversationContext(userId, guildId = null) {
    if (!this.enabled) {
      // Fallback to regular history if summarization disabled
      return await this.conversationManager.getConversationHistory(
        userId,
        guildId,
      );
    }

    const allMessages = await this.conversationManager.getConversationHistory(
      userId,
      guildId,
    );

    // If conversation is short, return all messages
    const nonSystemMessages = allMessages.filter(m => m.role !== "system");
    if (nonSystemMessages.length <= this.recentMessageCount) {
      return allMessages;
    }

    // Split into recent and old messages
    const recentMessages = allMessages.slice(-this.recentMessageCount);
    const oldMessages = allMessages.slice(0, -this.recentMessageCount);

    // Get or create summary for old messages
    let summary = null;
    if (oldMessages.length > 0) {
      summary = await this.summaryStorage.loadSummary(userId, guildId);

      // If no summary exists and we have enough old messages, create one
      if (!summary && oldMessages.length >= this.summarizationThreshold) {
        logger.debug(
          `Creating summary for user ${userId} in guild ${guildId || "DM"} (${oldMessages.length} old messages)`,
        );
        summary = await this.summarizer.summarizeConversation(oldMessages);
        if (summary) {
          await this.summaryStorage.saveSummary(userId, guildId, summary);
        }
      }
    }

    // Build context: summary + recent messages
    const context = [];
    if (summary) {
      context.push({
        role: "system",
        content: `Previous conversation summary: ${summary}`,
      });
    }
    context.push(...recentMessages);

    return context;
  }

  /**
   * Update summary when conversation grows
   * Called periodically or when conversation ends
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @param {Array} newMessages - New messages to add to summary
   * @returns {Promise<void>}
   */
  async updateSummary(userId, guildId, newMessages) {
    if (!this.enabled || !newMessages || newMessages.length === 0) {
      return;
    }

    try {
      const existingSummary = await this.summaryStorage.loadSummary(
        userId,
        guildId,
      );
      const updatedSummary = await this.summarizer.summarizeConversation(
        newMessages,
        existingSummary,
      );

      if (updatedSummary) {
        await this.summaryStorage.saveSummary(userId, guildId, updatedSummary);
        logger.debug(
          `Updated summary for user ${userId} in guild ${guildId || "DM"}`,
        );
      }
    } catch (error) {
      logger.debug("Failed to update summary:", error);
      // Don't throw - summary updates are non-critical
    }
  }

  /**
   * Check if summary should be updated
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {Promise<boolean>} True if should update
   */
  async shouldUpdateSummary(userId, guildId) {
    const allMessages = await this.conversationManager.getConversationHistory(
      userId,
      guildId,
    );
    const nonSystemMessages = allMessages.filter(m => m.role !== "system");

    // Update if we have more messages than recent count
    return nonSystemMessages.length > this.recentMessageCount;
  }

  /**
   * Clear summary for a conversation
   * @param {string} userId - User ID
   * @param {string|null} guildId - Guild ID
   * @returns {Promise<void>}
   */
  async clearSummary(userId, guildId = null) {
    await this.summaryStorage.deleteSummary(userId, guildId);
  }
}
