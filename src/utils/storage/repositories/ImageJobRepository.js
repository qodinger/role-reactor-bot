import { BaseRepository } from "./BaseRepository.js";

export class ImageJobRepository extends BaseRepository {
  constructor(db, cache, logger, collectionName) {
    super(db, collectionName, cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get(`${this.collection.collectionName}_all`);
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const jobs = {};
      for (const doc of documents) {
        // Use jobId as key, or _id if jobId doesn't exist
        const key = doc.jobId || doc._id.toString();
        // Remove MongoDB _id from the data
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = doc;
        jobs[key] = jobData;
      }

      this.cache.set(`${this.collection.collectionName}_all`, jobs);
      return jobs;
    } catch (error) {
      this.logger.error(
        `Failed to get all jobs from ${this.collection.collectionName}`,
        error,
      );
      return {};
    }
  }

  async getByJobId(jobId) {
    try {
      const cached = this.cache.get(
        `${this.collection.collectionName}_${jobId}`,
      );
      if (cached) return cached;

      const job = await this.collection.findOne({ jobId });
      if (job) {
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = job;
        this.cache.set(`${this.collection.collectionName}_${jobId}`, jobData);
        return jobData;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get job ${jobId} from ${this.collection.collectionName}`,
        error,
      );
      return null;
    }
  }

  async getByUserId(userId, limit = 20) {
    try {
      const cached = this.cache.get(
        `${this.collection.collectionName}_user_${userId}_${limit}`,
      );
      if (cached) return cached;

      const documents = await this.collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const jobs = documents.map(doc => {
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = doc;
        return { jobId: doc.jobId || doc._id.toString(), ...jobData };
      });

      this.cache.set(
        `${this.collection.collectionName}_user_${userId}_${limit}`,
        jobs,
      );
      return jobs;
    } catch (error) {
      this.logger.error(
        `Failed to get jobs for user ${userId} from ${this.collection.collectionName}`,
        error,
      );
      return [];
    }
  }

  async create(jobId, jobData) {
    try {
      await this.collection.insertOne({
        jobId,
        ...jobData,
        createdAt: new Date(jobData.createdAt || Date.now()),
        expiresAt: new Date(jobData.expiresAt || Date.now()),
      });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create job ${jobId} in ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async update(jobId, jobData) {
    try {
      await this.collection.updateOne(
        { jobId },
        { $set: { ...jobData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update job ${jobId} in ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async delete(jobId) {
    try {
      await this.collection.deleteOne({ jobId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete job ${jobId} from ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async deleteExpired() {
    try {
      const result = await this.collection.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete expired jobs from ${this.collection.collectionName}`,
        error,
      );
      return 0;
    }
  }

  async deleteOld(daysToKeep) {
    try {
      const cutoffTime = new Date(
        Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
      );
      // Only delete records without expiresAt or where expiresAt is null/undefined
      // Records with expiresAt should be handled by deleteExpired()
      const result = await this.collection.deleteMany({
        createdAt: { $lt: cutoffTime },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete old jobs from ${this.collection.collectionName}`,
        error,
      );
      return 0;
    }
  }
}
