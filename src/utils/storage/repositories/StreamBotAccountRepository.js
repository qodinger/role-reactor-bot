import { BaseRepository } from "./BaseRepository.js";

/**
 * Stores the single global RoleReactor Twitch bot account used to send chat
 * messages (so the Verified Bot badge appears). One document, keyed by _id.
 */
export class StreamBotAccountRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "stream_bot_account", cache, logger);
  }

  async get() {
    try {
      return await this.collection.findOne({ _id: "global" });
    } catch (error) {
      this.logger.error("Failed to get stream bot account", error);
      throw error;
    }
  }

  async upsert(account) {
    try {
      const result = await this.collection.updateOne(
        { _id: "global" },
        { $set: { ...account, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error("Failed to upsert stream bot account", error);
      throw error;
    }
  }
}
