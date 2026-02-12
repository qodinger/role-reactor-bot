import { BaseRepository } from "./BaseRepository.js";

export class RecurringScheduleRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "recurring_schedules", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("recurring_schedules_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set("recurring_schedules_all", schedules);
      return schedules;
    } catch (error) {
      this.logger.error("Failed to get all recurring schedules", error);
      return {};
    }
  }

  async getById(scheduleId) {
    try {
      const cached = this.cache.get(`recurring_schedule_${scheduleId}`);
      if (cached) return cached;

      const schedule = await this.collection.findOne({ id: scheduleId });
      if (schedule) {
        this.cache.set(`recurring_schedule_${scheduleId}`, schedule);
      }
      return schedule;
    } catch (error) {
      this.logger.error(
        `Failed to get recurring schedule ${scheduleId}`,
        error,
      );
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`recurring_schedules_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set(`recurring_schedules_guild_${guildId}`, schedules);
      return schedules;
    } catch (error) {
      this.logger.error(
        `Failed to get recurring schedules for guild ${guildId}`,
        error,
      );
      return {};
    }
  }

  async findActive() {
    try {
      const documents = await this.collection
        .find({
          active: true,
          cancelled: { $ne: true },
        })
        .toArray();
      return documents;
    } catch (error) {
      this.logger.error("Failed to find active recurring schedules", error);
      return [];
    }
  }

  async create(scheduleData) {
    try {
      const document = {
        ...scheduleData,
        lastExecutedAt: scheduleData.lastExecutedAt
          ? new Date(scheduleData.lastExecutedAt)
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(document);
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create recurring schedule", error);
      return false;
    }
  }

  async update(scheduleId, scheduleData) {
    try {
      const dataToUpdate = { ...scheduleData, updatedAt: new Date() };
      if (dataToUpdate.lastExecutedAt) {
        dataToUpdate.lastExecutedAt = new Date(dataToUpdate.lastExecutedAt);
      }
      await this.collection.updateOne(
        { id: scheduleId },
        { $set: dataToUpdate },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async delete(scheduleId) {
    try {
      await this.collection.deleteOne({ id: scheduleId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async cancel(scheduleId) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            active: false,
            cancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to cancel recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async updateLastExecuted(scheduleId, lastExecutedAt) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            lastExecutedAt: new Date(lastExecutedAt),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update last executed time for schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }
}
