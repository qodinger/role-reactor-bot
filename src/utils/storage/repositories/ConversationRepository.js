import { BaseRepository } from "./BaseRepository.js";

export class ConversationRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "ai_conversations", cache, logger);
  }

  async getByUser(userId, guildId = null) {
    try {
      // Create composite key for cache
      const cacheKey = `conversation_${userId}_${guildId || "dm"}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      // Query by userId and guildId (or null for DMs)
      const query = { userId };
      if (guildId) {
        query.guildId = guildId;
      } else {
        query.guildId = null; // Explicitly match null for DMs
      }

      const conversation = await this.collection.findOne(query);
      if (conversation) {
        this.cache.set(cacheKey, conversation);
      }
      return conversation || null;
    } catch (error) {
      this.logger.error(
        `Failed to get conversation for user ${userId} in guild ${guildId || "DM"}`,
        error,
      );
      return null;
    }
  }

  async save(userId, guildId, messages, lastActivity) {
    try {
      // Use composite key: userId + guildId (or null for DMs)
      const query = { userId };
      if (guildId) {
        query.guildId = guildId;
      } else {
        query.guildId = null; // Explicitly set null for DMs
      }

      await this.collection.updateOne(
        query,
        {
          $set: {
            userId,
            guildId: guildId || null,
            messages,
            lastActivity: new Date(lastActivity),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Update cache with composite key
      const cacheKey = `conversation_${userId}_${guildId || "dm"}`;
      this.cache.set(cacheKey, {
        userId,
        guildId: guildId || null,
        messages,
        lastActivity,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to save conversation for user ${userId} in guild ${guildId || "DM"}`,
        error,
      );
      return false;
    }
  }

  async delete(userId, guildId = null) {
    try {
      const query = { userId };
      if (guildId) {
        query.guildId = guildId;
      } else {
        query.guildId = null; // Explicitly match null for DMs
      }

      await this.collection.deleteOne(query);

      // Delete from cache
      const cacheKey = `conversation_${userId}_${guildId || "dm"}`;
      this.cache.delete(cacheKey);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete conversation for user ${userId} in guild ${guildId || "DM"}`,
        error,
      );
      return false;
    }
  }

  async deleteExpired(expirationTime) {
    try {
      const result = await this.collection.deleteMany({
        lastActivity: { $lt: new Date(expirationTime) },
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error("Failed to delete expired conversations", error);
      return 0;
    }
  }
}
