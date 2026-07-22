import { BaseRepository } from "./BaseRepository.js";

export class StarboardMessageRepository extends BaseRepository {
  constructor(db, cacheManager, logger) {
    super(db, "starboard_messages", cacheManager, logger);
  }

  async getMessageMapping(guildId, originalMessageId) {
    const cacheKey = `starboard_msg:${guildId}:${originalMessageId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.collection.findOne({ guildId, originalMessageId });
    if (result) {
      this.cache.set(cacheKey, result);
    }
    return result;
  }

  async upsertMessageMapping(guildId, originalMessageId, data) {
    const result = await this.collection.findOneAndUpdate(
      { guildId, originalMessageId },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    this.cache.delete(`starboard_msg:${guildId}:${originalMessageId}`);
    return result;
  }

  async deleteMessageMapping(guildId, originalMessageId) {
    await this.collection.deleteOne({ guildId, originalMessageId });
    this.cache.delete(`starboard_msg:${guildId}:${originalMessageId}`);
  }
}
