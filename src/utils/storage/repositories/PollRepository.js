import { BaseRepository } from "./BaseRepository.js";

export class PollRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "polls", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("polls_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const polls = {};
      for (const doc of documents) {
        polls[doc.id] = doc;
      }

      this.cache.set("polls_all", polls);
      return polls;
    } catch (error) {
      this.logger.error("Failed to get all polls", error);
      return {};
    }
  }

  async getById(pollId) {
    try {
      const cached = this.cache.get(`poll_${pollId}`);
      if (cached) return cached;

      const poll = await this.collection.findOne({ id: pollId });
      if (poll) {
        this.cache.set(`poll_${pollId}`, poll);
      }
      return poll;
    } catch (error) {
      this.logger.error(`Failed to get poll ${pollId}`, error);
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`polls_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const polls = {};
      for (const doc of documents) {
        polls[doc.id] = doc;
      }

      this.cache.set(`polls_guild_${guildId}`, polls);
      return polls;
    } catch (error) {
      this.logger.error(`Failed to get polls for guild ${guildId}`, error);
      return {};
    }
  }

  async getByMessageId(messageId) {
    try {
      const cached = this.cache.get(`poll_message_${messageId}`);
      if (cached) return cached;

      const poll = await this.collection.findOne({ messageId });
      if (poll) {
        this.cache.set(`poll_message_${messageId}`, poll);
      }
      return poll;
    } catch (error) {
      this.logger.error(`Failed to get poll by message ID ${messageId}`, error);
      return null;
    }
  }

  async create(pollData) {
    try {
      await this.collection.insertOne({
        ...pollData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create poll", error);
      return false;
    }
  }

  async update(pollId, pollData) {
    try {
      await this.collection.updateOne(
        { id: pollId },
        { $set: { ...pollData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to update poll ${pollId}`, error);
      return false;
    }
  }

  async delete(pollId) {
    try {
      await this.collection.deleteOne({ id: pollId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete poll ${pollId}`, error);
      return false;
    }
  }

  async cleanupEndedPolls() {
    try {
      const now = new Date();
      const result = await this.collection.deleteMany({
        isActive: false,
        endedAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      }); // Only delete ended polls older than 24 hours

      if (result.deletedCount > 0) {
        this.cache.clear();
        this.logger.info(`Cleaned up ${result.deletedCount} ended polls`);
      }

      return result.deletedCount;
    } catch (error) {
      this.logger.error("Failed to cleanup ended polls", error);
      return 0;
    }
  }
}
