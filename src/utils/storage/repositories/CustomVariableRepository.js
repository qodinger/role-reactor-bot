import { BaseRepository } from "./BaseRepository.js";

export class CustomVariableRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "custom_variables", cache, logger);
  }

  /**
   * Get a variable definition by name
   * @param {string} guildId
   * @param {string} name
   */
  async getByName(guildId, name) {
    const cacheKey = `custom_variables:guild:${guildId}:name:${name}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const doc = await this.collection.findOne({ guildId, name });
    if (doc) this.cache.set(cacheKey, doc);
    return doc;
  }

  /**
   * Get all variable definitions for a guild
   * @param {string} guildId
   */
  async getByGuild(guildId) {
    const cacheKey = `custom_variables:guild:${guildId}`;
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
   * Get variable definition by ID
   * @param {string} guildId
   * @param {string} variableId
   */
  async getById(guildId, variableId) {
    return this.collection.findOne({ guildId, variableId });
  }

  /**
   * Get the resolved value of a variable.
   * For guild scope, targetId is null.
   * For user/channel scope, targetId is the user or channel ID.
   * @param {string} guildId
   * @param {string} name
   * @param {string|null} targetId
   */
  async getValue(guildId, name, targetId = null) {
    const variable = await this.getByName(guildId, name);
    if (!variable) return null;

    if (variable.scope === "guild" || !targetId) {
      return variable.defaultValue ?? null;
    }

    // User or channel scoped — look in values map
    const values = variable.values || {};
    return values[targetId] !== undefined
      ? values[targetId]
      : (variable.defaultValue ?? null);
  }

  /**
   * Set the value of a variable.
   * @param {string} guildId
   * @param {string} name
   * @param {*} value
   * @param {string|null} targetId
   */
  async setValue(guildId, name, value, targetId = null) {
    const variable = await this.getByName(guildId, name);
    if (!variable) return false;

    if (variable.scope === "guild" || !targetId) {
      await this.collection.updateOne(
        { guildId, name },
        { $set: { defaultValue: value, updatedAt: new Date() } },
      );
    } else {
      await this.collection.updateOne(
        { guildId, name },
        {
          $set: {
            [`values.${targetId}`]: value,
            updatedAt: new Date(),
          },
        },
      );
    }

    this._clearGuildCache(guildId);
    return true;
  }

  /**
   * Increment a numeric variable by an amount (default +1).
   * @param {string} guildId
   * @param {string} name
   * @param {number} amount
   * @param {string|null} targetId
   */
  async incrementValue(guildId, name, amount = 1, targetId = null) {
    const current = await this.getValue(guildId, name, targetId);
    const currentNum = Number(current) || 0;
    return this.setValue(guildId, name, currentNum + amount, targetId);
  }

  /**
   * Delete a scoped value (resets to default) or clear the guild variable's value.
   * @param {string} guildId
   * @param {string} name
   * @param {string|null} targetId
   */
  async deleteValue(guildId, name, targetId = null) {
    const variable = await this.getByName(guildId, name);
    if (!variable) return false;

    if (!targetId || variable.scope === "guild") {
      await this.collection.updateOne(
        { guildId, name },
        { $set: { defaultValue: null, updatedAt: new Date() } },
      );
    } else {
      await this.collection.updateOne(
        { guildId, name },
        {
          $unset: { [`values.${targetId}`]: "" },
          $set: { updatedAt: new Date() },
        },
      );
    }

    this._clearGuildCache(guildId);
    return true;
  }

  /**
   * Count variables for a guild
   * @param {string} guildId
   */
  async countByGuild(guildId) {
    return this.collection.countDocuments({ guildId });
  }

  /**
   * Create a new variable definition
   * @param {object} data
   */
  async create(data) {
    await this.collection.insertOne(data);
    this._clearGuildCache(data.guildId);
    return data;
  }

  /**
   * Update a variable definition
   * @param {string} guildId
   * @param {string} variableId
   * @param {object} data
   */
  async update(guildId, variableId, data) {
    await this.collection.updateOne(
      { guildId, variableId },
      { $set: { ...data, updatedAt: new Date() } },
    );
    this._clearGuildCache(guildId);
  }

  /**
   * Delete a variable definition entirely
   * @param {string} guildId
   * @param {string} variableId
   */
  async delete(guildId, variableId) {
    await this.collection.deleteOne({ guildId, variableId });
    this._clearGuildCache(guildId);
  }

  _clearGuildCache(guildId) {
    this.cache.invalidatePrefix(`custom_variables:guild:${guildId}`);
  }
}
