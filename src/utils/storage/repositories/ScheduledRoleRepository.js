import { BaseRepository } from "./BaseRepository.js";

export class ScheduledRoleRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "scheduled_roles", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("scheduled_roles_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set("scheduled_roles_all", schedules);
      return schedules;
    } catch (error) {
      this.logger.error("Failed to get all scheduled roles", error);
      return {};
    }
  }

  async getById(scheduleId) {
    try {
      const cached = this.cache.get(`scheduled_role_${scheduleId}`);
      if (cached) return cached;

      const schedule = await this.collection.findOne({ id: scheduleId });
      if (schedule) {
        this.cache.set(`scheduled_role_${scheduleId}`, schedule);
      }
      return schedule;
    } catch (error) {
      this.logger.error(`Failed to get scheduled role ${scheduleId}`, error);
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`scheduled_roles_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set(`scheduled_roles_guild_${guildId}`, schedules);
      return schedules;
    } catch (error) {
      this.logger.error(
        `Failed to get scheduled roles for guild ${guildId}`,
        error,
      );
      return {};
    }
  }

  async findDue() {
    try {
      const now = new Date();
      const documents = await this.collection
        .find({
          scheduledAt: { $lte: now },
          executed: { $ne: true },
          cancelled: { $ne: true },
        })
        .toArray();

      // Ensure scheduledAt is a Date object, not a string
      const processedDocuments = documents.map(doc => {
        if (doc.scheduledAt && typeof doc.scheduledAt === "string") {
          doc.scheduledAt = new Date(doc.scheduledAt);
        }
        return doc;
      });

      return processedDocuments;
    } catch (error) {
      this.logger.error("Failed to find due scheduled roles", error);
      return [];
    }
  }

  async create(scheduleData) {
    try {
      const document = {
        ...scheduleData,
        scheduledAt: scheduleData.scheduledAt
          ? new Date(scheduleData.scheduledAt)
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(document);
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create scheduled role", error);
      return false;
    }
  }

  async update(scheduleId, scheduleData) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        { $set: { ...scheduleData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to update scheduled role ${scheduleId}`, error);
      return false;
    }
  }

  async delete(scheduleId) {
    try {
      await this.collection.deleteOne({ id: scheduleId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete scheduled role ${scheduleId}`, error);
      return false;
    }
  }

  async markExecuted(scheduleId) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            executed: true,
            executedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to mark scheduled role ${scheduleId} as executed`,
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
            cancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled role ${scheduleId}`, error);
      return false;
    }
  }
}
