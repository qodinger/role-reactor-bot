import { BaseRepository } from "./BaseRepository.js";

export class CoreCreditsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "core_credits", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ userId: 1 }, { unique: true });
      this.logger.debug("CoreCreditsRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure CoreCreditsRepository indexes", error);
    }
  }

  async getAll() {
    try {
      const cached = this.cache.get("core_credits_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const coreCredits = {};
      for (const doc of documents) {
        coreCredits[doc.userId] = doc;
      }

      this.cache.set("core_credits_all", coreCredits);
      return coreCredits;
    } catch (error) {
      this.logger.error("Failed to get all core credits", error);
      return {};
    }
  }

  async getByUserId(userId) {
    try {
      const cached = this.cache.get(`core_credits_${userId}`);
      if (cached) return cached;

      const userData = await this.collection.findOne({ userId });
      if (userData) {
        this.cache.set(`core_credits_${userId}`, userData);
      }
      return userData;
    } catch (error) {
      this.logger.error(`Failed to get core credits for user ${userId}`, error);
      return null;
    }
  }

  async setByUserId(userId, userData) {
    try {
      // Ensure userId is included in the document
      const document = { ...userData, userId };

      const result = await this.collection.replaceOne({ userId }, document, {
        upsert: true,
      });

      // Update cache
      this.cache.set(`core_credits_${userId}`, document);
      this.cache.clear(); // Invalidate all cache

      return result.acknowledged;
    } catch (error) {
      this.logger.error(`Failed to set core credits for user ${userId}`, error);
      return false;
    }
  }

  async updateCredits(userId, creditsChange) {
    try {
      const result = await this.collection.updateOne(
        { userId },
        {
          $inc: { credits: creditsChange },
          $set: { lastUpdated: new Date().toISOString() },
        },
        { upsert: true },
      );

      // Invalidate cache
      this.cache.clear();

      return result.acknowledged;
    } catch (error) {
      this.logger.error(`Failed to update credits for user ${userId}`, error);
      return false;
    }
  }

  async deleteByUserId(userId) {
    try {
      const result = await this.collection.deleteOne({ userId });

      // Invalidate cache
      this.cache.clear();

      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete core credits for user ${userId}`,
        error,
      );
      return false;
    }
  }
}
