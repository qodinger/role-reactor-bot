import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for user notifications
 * Stores in-app notification history (vote rewards, balance changes, pro engine events, etc.)
 */
export class NotificationRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "notifications", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, read: 1 });
      await this.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60 },
      ); // Auto-delete after 90 days
      this.logger.debug("NotificationRepository indexes ensured");
    } catch (error) {
      this.logger.debug(
        "NotificationRepository indexes already exist or error:",
        error.message,
      );
    }
  }

  /**
   * Create a new notification
   * @param {Object} data
   * @param {string} data.userId - Discord user ID
   * @param {string} data.type - Notification type: "vote_reward", "balance_added", "pro_activated", "pro_deactivated", "pro_renewed", "low_balance", "admin_adjustment"
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message body
   * @param {string} [data.icon] - Icon identifier: "vote", "core", "pro", "warning", "admin", "gift"
   * @param {Object} [data.metadata] - Extra data
   * @returns {Promise<Object|null>}
   */
  async create(data) {
    try {
      const notification = {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        icon: data.icon || "core",
        read: false,
        metadata: data.metadata || {},
        createdAt: new Date(),
      };

      const result = await this.collection.insertOne(notification);

      if (result.acknowledged) {
        notification._id = result.insertedId;
        this.cache.clear();
        return notification;
      }
      return null;
    } catch (error) {
      this.logger.error("Failed to create notification", error);
      return null;
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId
   * @param {Object} [options]
   * @param {number} [options.limit=20]
   * @param {number} [options.skip=0]
   * @param {boolean} [options.unreadOnly=false]
   * @returns {Promise<Array>}
   */
  async getByUserId(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, unreadOnly = false } = options;

      const query = { userId };
      if (unreadOnly) query.read = false;

      return await this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for user ${userId}`,
        error,
      );
      return [];
    }
  }

  /**
   * Get unread count for a user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    try {
      return await this.collection.countDocuments({ userId, read: false });
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${userId}`,
        error,
      );
      return 0;
    }
  }

  /**
   * Mark a single notification as read
   * @param {string} notificationId - MongoDB ObjectId as string
   * @param {string} userId - Owner verification
   * @returns {Promise<boolean>}
   */
  async markAsRead(notificationId, userId) {
    try {
      const { ObjectId } = await import("mongodb");
      const result = await this.collection.updateOne(
        { _id: new ObjectId(notificationId), userId },
        { $set: { read: true } },
      );
      this.cache.clear();
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to mark notification ${notificationId} as read`,
        error,
      );
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await this.collection.updateMany(
        { userId, read: false },
        { $set: { read: true } },
      );
      this.cache.clear();
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${userId}`,
        error,
      );
      return 0;
    }
  }
}
