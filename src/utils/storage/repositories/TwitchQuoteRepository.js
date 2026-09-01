import { BaseRepository } from "./BaseRepository.js";

export class TwitchQuoteRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "twitch_quotes", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex(
        { guildId: 1, id: 1 },
        { unique: true },
      );
      await this.collection.createIndex({ guildId: 1 });
      this.logger.debug("TwitchQuoteRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure TwitchQuoteRepository indexes", error);
    }
  }

  async getNextId(guildId) {
    const last = await this.collection.findOne(
      { guildId },
      { sort: { id: -1 } },
    );
    return (last?.id || 0) + 1;
  }

  async add(guildId, text, addedBy) {
    try {
      const id = await this.getNextId(guildId);
      const doc = { guildId, id, text, addedBy, createdAt: new Date() };
      await this.collection.insertOne(doc);
      this.cache.clear();
      return doc;
    } catch (error) {
      this.logger.error(`Failed to add quote for guild ${guildId}`, error);
      throw error;
    }
  }

  async getById(guildId, id) {
    try {
      return await this.collection.findOne({ guildId, id });
    } catch (error) {
      this.logger.error(
        `Failed to get quote ${id} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getRandom(guildId) {
    try {
      const count = await this.collection.countDocuments({ guildId });
      if (count === 0) return null;
      const skip = Math.floor(Math.random() * count);
      const [quote] = await this.collection
        .find({ guildId })
        .skip(skip)
        .limit(1)
        .toArray();
      return quote || null;
    } catch (error) {
      this.logger.error(
        `Failed to get random quote for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async list(guildId) {
    try {
      return await this.collection.find({ guildId }).sort({ id: 1 }).toArray();
    } catch (error) {
      this.logger.error(`Failed to list quotes for guild ${guildId}`, error);
      throw error;
    }
  }

  async remove(guildId, id) {
    try {
      const result = await this.collection.deleteOne({ guildId, id });
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove quote ${id} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async count(guildId) {
    try {
      return await this.collection.countDocuments({ guildId });
    } catch (error) {
      this.logger.error(`Failed to count quotes for guild ${guildId}`, error);
      throw error;
    }
  }
}
