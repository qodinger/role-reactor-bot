import { getLogger } from "../logger.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import { getStorageManager } from "../storage/storageManager.js";
import {
  DEFAULT_MAX_HISTORY_LENGTH,
  DEFAULT_CONVERSATION_TIMEOUT,
  DEFAULT_MAX_CONVERSATIONS,
} from "./constants.js";

const logger = getLogger();

/**
 * Manages conversation history and long-term memory for AI chat
 * Supports both MongoDB and local file storage for cost optimization
 */
export class ConversationManager {
  constructor() {
    this.conversations = new Map();
    this.dbManager = null;
    this.storageManager = null;
    // Track cleanup interval for proper cleanup
    this.cleanupInterval = null;

    // Configuration from environment variables
    this.useLongTermMemory = process.env.AI_USE_LONG_TERM_MEMORY !== "false";
    // Storage type: "file" (default), "mongodb", or "memory" (no persistence)
    // "file" saves to local JSON files instead of MongoDB
    // Default to "file", but allow override to "mongodb" if needed
    this.storageType = process.env.AI_CONVERSATION_STORAGE_TYPE || "file"; // file (default), mongodb, or memory
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
   * Initialize long-term memory (MongoDB or file storage) if available
   */
  async initLongTermMemory() {
    if (!this.useLongTermMemory) {
      logger.debug(
        "Long-term memory disabled via AI_USE_LONG_TERM_MEMORY=false",
      );
      return;
    }

    // Initialize file storage if storage type is "file"
    if (this.storageType === "file") {
      try {
        this.storageManager = await getStorageManager();
        logger.info(
          "✅ Long-term memory (local file storage) enabled for conversations - saves MongoDB costs",
        );
        // Preload recent conversations from files
        if (process.env.AI_PRELOAD_CONVERSATIONS !== "false") {
          this.preloadRecentConversationsFromFiles().catch(error => {
            logger.debug("Failed to preload conversations from files:", error);
          });
        }
        return;
      } catch (error) {
        logger.debug(
          "⚠️ Failed to initialize file storage, falling back to in-memory:",
          error.message,
        );
        this.storageType = "memory";
        return;
      }
    }

    // Initialize MongoDB storage if storage type is "mongodb" (default)
    if (this.storageType === "mongodb") {
      try {
        this.dbManager = await getDatabaseManager();
        if (this.dbManager && this.dbManager.conversations) {
          logger.info(
            "✅ Long-term memory (MongoDB) enabled for conversations",
          );
          // Preload recent conversations (optional optimization)
          if (process.env.AI_PRELOAD_CONVERSATIONS !== "false") {
            this.preloadRecentConversations().catch(error => {
              logger.debug("Failed to preload conversations:", error);
            });
          }
        } else {
          logger.debug(
            "⚠️ MongoDB not available, falling back to in-memory storage only",
          );
          this.storageType = "memory";
        }
      } catch (error) {
        logger.debug(
          "⚠️ Failed to initialize MongoDB, falling back to in-memory:",
          error.message,
        );
        this.storageType = "memory";
      }
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
   * Preload recent conversations from MongoDB into memory cache
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
          `Preloaded ${loaded} recent conversation(s) from MongoDB into memory cache`,
        );
      }
    } catch (error) {
      logger.debug("Failed to preload conversations from MongoDB:", error);
    }
  }

  /**
   * Preload recent conversations from local files into memory cache
   * Only loads conversations active in last 24 hours to avoid memory bloat
   */
  async preloadRecentConversationsFromFiles() {
    if (!this.useLongTermMemory || !this.storageManager) {
      return;
    }

    try {
      const recentThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      const conversationsData =
        (await this.storageManager.read("ai_conversations")) || {};

      let loaded = 0;
      for (const [userId, conv] of Object.entries(conversationsData)) {
        // Filter out system messages from stored data
        const messages = (conv.messages || []).filter(m => m.role !== "system");
        if (messages.length === 0) {
          continue; // Skip conversations with only system messages
        }

        const lastActivity =
          typeof conv.lastActivity === "number"
            ? conv.lastActivity
            : new Date(conv.lastActivity).getTime();
        // Only load if recent and not expired
        if (
          lastActivity >= recentThreshold &&
          Date.now() - lastActivity <= this.conversationTimeout
        ) {
          this.conversations.set(userId, {
            messages, // Already filtered to exclude system messages
            lastActivity,
          });
          loaded++;
        }
      }

      if (loaded > 0) {
        logger.debug(
          `Preloaded ${loaded} recent conversation(s) from files into memory cache`,
        );
      }
    } catch (error) {
      logger.debug("Failed to preload conversations from files:", error);
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
        // Also delete from storage if LTM enabled
        if (this.useLongTermMemory) {
          await this.deleteFromStorage(userId);
        }
        return [];
      }
      return cached.messages || [];
    }

    // If not in cache, try loading from storage (LTM)
    if (this.useLongTermMemory) {
      try {
        let conversation = null;

        // Load from MongoDB
        if (this.storageType === "mongodb" && this.dbManager?.conversations) {
          const dbConversation =
            await this.dbManager.conversations.getByUser(userId);
          if (dbConversation) {
            conversation = {
              messages: dbConversation.messages || [],
              lastActivity: new Date(dbConversation.lastActivity).getTime(),
            };
          }
        }
        // Load from file storage
        else if (this.storageType === "file" && this.storageManager) {
          const conversationsData =
            (await this.storageManager.read("ai_conversations")) || {};
          const fileConv = conversationsData[userId];
          if (fileConv) {
            // Filter out system messages from stored data (they shouldn't be there, but just in case)
            const messages = (fileConv.messages || []).filter(
              m => m.role !== "system",
            );
            conversation = {
              messages,
              lastActivity:
                typeof fileConv.lastActivity === "number"
                  ? fileConv.lastActivity
                  : new Date(fileConv.lastActivity).getTime(),
            };
          }
        }

        if (conversation) {
          // Check if expired
          if (
            Date.now() - conversation.lastActivity >
            this.conversationTimeout
          ) {
            await this.deleteFromStorage(userId);
            return [];
          }
          // Load into memory cache
          this.conversations.set(userId, conversation);
          return conversation.messages || [];
        }
      } catch (error) {
        logger.debug("Failed to load conversation from storage:", error);
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

    // Don't store system messages - they're dynamically generated and very large
    // System messages are only kept in memory for the current conversation
    if (message.role === "system") {
      // Only keep system message in memory, don't persist to storage
      if (
        conversation.messages.length === 0 ||
        conversation.messages[0]?.role !== "system"
      ) {
        conversation.messages.unshift({
          role: message.role,
          content: message.content,
        });
      } else {
        // Update existing system message in memory
        conversation.messages[0] = {
          role: message.role,
          content: message.content,
        };
      }
      return; // Don't save system messages to storage
    }

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

    // Save to storage for LTM (async, don't wait) - exclude system messages
    if (this.useLongTermMemory) {
      const messagesToSave = conversation.messages.filter(
        m => m.role !== "system",
      );
      this.saveToStorage(
        userId,
        messagesToSave,
        conversation.lastActivity,
      ).catch(error => {
        // Log but don't throw - LTM failures shouldn't break conversation flow
        logger.debug(
          `Failed to save conversation for user ${userId} to storage:`,
          error,
        );
      });
    }
  }

  /**
   * Save conversation to storage (MongoDB or file)
   * @param {string} userId - User ID
   * @param {Array} messages - Conversation messages
   * @param {number} lastActivity - Last activity timestamp
   */
  async saveToStorage(userId, messages, lastActivity) {
    if (this.storageType === "mongodb" && this.dbManager?.conversations) {
      await this.dbManager.conversations.save(userId, messages, lastActivity);
    } else if (this.storageType === "file" && this.storageManager) {
      const conversationsData =
        (await this.storageManager.read("ai_conversations")) || {};
      conversationsData[userId] = {
        messages,
        lastActivity,
      };
      await this.storageManager.write("ai_conversations", conversationsData);
    }
  }

  /**
   * Delete conversation from storage (MongoDB or file)
   * @param {string} userId - User ID
   */
  async deleteFromStorage(userId) {
    if (this.storageType === "mongodb" && this.dbManager?.conversations) {
      await this.dbManager.conversations.delete(userId).catch(error => {
        logger.debug(
          `Failed to delete conversation for user ${userId} from MongoDB:`,
          error,
        );
      });
    } else if (this.storageType === "file" && this.storageManager) {
      try {
        const conversationsData =
          (await this.storageManager.read("ai_conversations")) || {};
        delete conversationsData[userId];
        await this.storageManager.write("ai_conversations", conversationsData);
      } catch (error) {
        logger.debug(
          `Failed to delete conversation for user ${userId} from files:`,
          error,
        );
      }
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
      // Also delete from storage if LTM enabled
      if (this.useLongTermMemory) {
        await this.deleteFromStorage(userId);
      }
    }
  }

  /**
   * Start cleanup interval for expired conversations (optimized)
   */
  startCleanup() {
    // Clean up expired conversations every 3 minutes
    this.cleanupInterval = setInterval(
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

          // Also delete from storage if LTM enabled
          if (this.useLongTermMemory) {
            this.deleteFromStorage(userId).catch(error => {
              logger.debug(
                `Failed to delete expired conversation for user ${userId}:`,
                error,
              );
            });
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

  /**
   * Stop cleanup interval (for testing or graceful shutdown)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const conversationManager = new ConversationManager();
