import { getLogger } from "../logger.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import {
  DEFAULT_MAX_HISTORY_LENGTH,
  DEFAULT_CONVERSATION_TIMEOUT,
  DEFAULT_MAX_CONVERSATIONS,
} from "./constants.js";

const logger = getLogger();

/**
 * Manages conversation history and long-term memory for AI chat
 */
export class ConversationManager {
  constructor() {
    this.conversations = new Map();
    this.dbManager = null;

    // Configuration from environment variables
    this.useLongTermMemory = process.env.AI_USE_LONG_TERM_MEMORY !== "false";
    this.maxHistoryLength =
      parseInt(process.env.AI_CONVERSATION_HISTORY_LENGTH) ||
      DEFAULT_MAX_HISTORY_LENGTH;
    this.conversationTimeout =
      parseInt(process.env.AI_CONVERSATION_TIMEOUT) ||
      DEFAULT_CONVERSATION_TIMEOUT;
    this.maxConversations =
      parseInt(process.env.AI_MAX_CONVERSATIONS) || DEFAULT_MAX_CONVERSATIONS;

    // Initialize
    this.initLongTermMemory();
    this.startCleanup();
  }

  /**
   * Initialize long-term memory (MongoDB) if available
   */
  async initLongTermMemory() {
    if (!this.useLongTermMemory) {
      logger.debug(
        "Long-term memory disabled via AI_USE_LONG_TERM_MEMORY=false",
      );
      return;
    }

    try {
      this.dbManager = await getDatabaseManager();
      if (this.dbManager && this.dbManager.conversations) {
        logger.info("✅ Long-term memory (MongoDB) enabled for conversations");
        // Preload recent conversations (optional optimization)
        if (process.env.AI_PRELOAD_CONVERSATIONS !== "false") {
          this.preloadRecentConversations().catch(error => {
            logger.debug("Failed to preload conversations:", error);
          });
        }
      } else {
        logger.debug("⚠️ MongoDB not available, using in-memory storage only");
        this.useLongTermMemory = false;
      }
    } catch (error) {
      logger.debug("⚠️ Failed to initialize long-term memory:", error.message);
      this.useLongTermMemory = false;
    }
  }

  /**
   * Set configuration for conversation management
   * @param {Object} config - Configuration object
   * @param {number} config.maxHistoryLength - Maximum history length
   * @param {number} config.conversationTimeout - Conversation timeout in ms
   * @param {number} config.maxConversations - Maximum number of conversations
   */
  setConfig(config) {
    if (config.maxHistoryLength !== undefined) {
      this.maxHistoryLength = config.maxHistoryLength;
    }
    if (config.conversationTimeout !== undefined) {
      this.conversationTimeout = config.conversationTimeout;
    }
    if (config.maxConversations !== undefined) {
      this.maxConversations = config.maxConversations;
    }
  }

  /**
   * Preload recent conversations into memory cache (performance optimization)
   * Only loads conversations active in last 24 hours to avoid memory bloat
   */
  async preloadRecentConversations() {
    if (!this.useLongTermMemory || !this.dbManager?.conversations) {
      return;
    }

    try {
      const recentThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      const collection = this.dbManager.conversations.collection;
      const recent = await collection
        .find({
          lastActivity: { $gte: new Date(recentThreshold) },
        })
        .limit(100) // Limit to 100 most recent to avoid memory issues
        .toArray();

      let loaded = 0;
      for (const conv of recent) {
        const lastActivity = new Date(conv.lastActivity).getTime();
        // Only load if not expired
        if (Date.now() - lastActivity <= this.conversationTimeout) {
          this.conversations.set(conv.userId, {
            messages: conv.messages || [],
            lastActivity,
          });
          loaded++;
        }
      }

      if (loaded > 0) {
        logger.debug(
          `Preloaded ${loaded} recent conversation(s) into memory cache`,
        );
      }
    } catch (error) {
      logger.debug("Failed to preload conversations:", error);
    }
  }

  /**
   * Get conversation history for a user (with LTM support)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversationHistory(userId) {
    // Try in-memory cache first (fast)
    const cached = this.conversations.get(userId);
    if (cached) {
      // Check if conversation expired
      if (Date.now() - cached.lastActivity > this.conversationTimeout) {
        this.conversations.delete(userId);
        // Also delete from database if LTM enabled
        if (this.useLongTermMemory && this.dbManager?.conversations) {
          await this.dbManager.conversations.delete(userId).catch(() => {});
        }
        return [];
      }
      return cached.messages || [];
    }

    // If not in cache, try loading from database (LTM)
    if (this.useLongTermMemory && this.dbManager?.conversations) {
      try {
        const dbConversation =
          await this.dbManager.conversations.getByUser(userId);
        if (dbConversation) {
          const lastActivity = new Date(dbConversation.lastActivity).getTime();
          // Check if expired
          if (Date.now() - lastActivity > this.conversationTimeout) {
            await this.dbManager.conversations.delete(userId);
            return [];
          }
          // Load into memory cache
          this.conversations.set(userId, {
            messages: dbConversation.messages || [],
            lastActivity,
          });
          return dbConversation.messages || [];
        }
      } catch (error) {
        logger.debug("Failed to load conversation from database:", error);
      }
    }

    return [];
  }

  /**
   * Add message to conversation history (with LTM support)
   * @param {string} userId - User ID
   * @param {Object} message - Message object with role and content
   */
  async addToHistory(userId, message) {
    if (!userId) return;

    // Enforce conversation limit - remove oldest if at capacity
    if (this.conversations.size >= this.maxConversations) {
      this.evictOldestConversation();
    }

    let conversation = this.conversations.get(userId);
    if (!conversation) {
      conversation = {
        messages: [],
        lastActivity: Date.now(),
      };
      this.conversations.set(userId, conversation);
    }

    // Update last activity
    conversation.lastActivity = Date.now();

    // Add message (optimized: don't store timestamp to save memory)
    conversation.messages.push({
      role: message.role,
      content: message.content,
    });

    // Optimized: Keep only last N messages (excluding system message)
    const nonSystemMessages = conversation.messages.filter(
      m => m.role !== "system",
    );
    if (nonSystemMessages.length > this.maxHistoryLength) {
      // Remove oldest messages (keep system + recent messages)
      const systemMessage =
        conversation.messages[0]?.role === "system"
          ? conversation.messages[0]
          : null;
      const recentMessages = nonSystemMessages.slice(-this.maxHistoryLength);
      conversation.messages = systemMessage
        ? [systemMessage, ...recentMessages]
        : recentMessages;
    }

    // Save to database for LTM (async, don't wait)
    if (this.useLongTermMemory && this.dbManager?.conversations) {
      this.dbManager.conversations
        .save(userId, conversation.messages, conversation.lastActivity)
        .catch(error => {
          logger.debug("Failed to save conversation to database:", error);
        });
    }
  }

  /**
   * Evict oldest conversation when at capacity (LRU-style)
   */
  evictOldestConversation() {
    let oldestUserId = null;
    let oldestTime = Date.now();

    for (const [userId, conversation] of this.conversations.entries()) {
      if (conversation.lastActivity < oldestTime) {
        oldestTime = conversation.lastActivity;
        oldestUserId = userId;
      }
    }

    if (oldestUserId) {
      this.conversations.delete(oldestUserId);
      logger.debug(`Evicted oldest conversation for user ${oldestUserId}`);
    }
  }

  /**
   * Clear conversation history for a user (with LTM support)
   * @param {string} userId - User ID
   */
  async clearHistory(userId) {
    if (userId) {
      this.conversations.delete(userId);
      // Also delete from database if LTM enabled
      if (this.useLongTermMemory && this.dbManager?.conversations) {
        await this.dbManager.conversations.delete(userId).catch(() => {});
      }
    }
  }

  /**
   * Start cleanup interval for expired conversations (optimized)
   */
  startCleanup() {
    // Clean up expired conversations every 3 minutes
    setInterval(
      () => {
        const now = Date.now();
        let cleaned = 0;
        const toDelete = [];

        for (const [userId, conversation] of this.conversations.entries()) {
          if (now - conversation.lastActivity > this.conversationTimeout) {
            toDelete.push(userId);
          }
        }

        // Delete expired conversations
        for (const userId of toDelete) {
          this.conversations.delete(userId);
          cleaned++;

          // Also delete from database if LTM enabled
          if (this.useLongTermMemory && this.dbManager?.conversations) {
            this.dbManager.conversations.delete(userId).catch(() => {});
          }
        }

        if (cleaned > 0) {
          logger.debug(`Cleaned up ${cleaned} expired conversation(s)`);
        }

        // Clean up expired system message cache
        // This is handled by the system message cache itself, but we can trigger cleanup here
        // if needed in the future
      },
      3 * 60 * 1000,
    ); // Every 3 minutes
  }
}

export const conversationManager = new ConversationManager();
