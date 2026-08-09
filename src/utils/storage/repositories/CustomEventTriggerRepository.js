import { BaseRepository } from "./BaseRepository.js";

export class CustomEventTriggerRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "custom_event_triggers", cache, logger);
  }

  /**
   * Get all event triggers for a guild
   * @param {string} guildId
   */
  async getByGuild(guildId) {
    const cacheKey = `custom_event_triggers:guild:${guildId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const docs = await this.collection
      .find({ guildId })
      .sort({ createdAt: -1 })
      .toArray();
    this.cache.set(cacheKey, docs);
    return docs;
  }

  /**
   * Get enabled triggers matching a specific event type for a guild
   * @param {string} guildId
   * @param {string} eventType
   */
  async getByEventType(guildId, eventType) {
    const cacheKey = `custom_event_triggers:guild:${guildId}:type:${eventType}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const docs = await this.collection
      .find({ guildId, "trigger.type": eventType, enabled: true })
      .sort({ createdAt: -1 })
      .toArray();
    this.cache.set(cacheKey, docs);
    return docs;
  }

  /**
   * Get a trigger by ID
   * @param {string} guildId
   * @param {string} triggerId
   */
  async getById(guildId, triggerId) {
    return this.collection.findOne({ guildId, triggerId });
  }

  /**
   * Count triggers for a guild
   * @param {string} guildId
   */
  async countByGuild(guildId) {
    return this.collection.countDocuments({ guildId });
  }

  /**
   * Create a new event trigger
   * @param {object} data
   */
  async create(data) {
    await this.collection.insertOne(data);
    this._clearGuildCache(data.guildId);
    return data;
  }

  /**
   * Update an event trigger
   * @param {string} guildId
   * @param {string} triggerId
   * @param {object} data
   */
  async update(guildId, triggerId, data) {
    await this.collection.updateOne(
      { guildId, triggerId },
      { $set: { ...data, updatedAt: new Date() } },
    );
    this._clearGuildCache(guildId);
  }

  /**
   * Delete an event trigger
   * @param {string} guildId
   * @param {string} triggerId
   */
  async delete(guildId, triggerId) {
    await this.collection.deleteOne({ guildId, triggerId });
    this._clearGuildCache(guildId);
  }

  _clearGuildCache(guildId) {
    this.cache.invalidatePrefix(`custom_event_triggers:guild:${guildId}`);
  }
}
