export class DatabaseImageJobsProvider {
  constructor(dbManager, logger) {
    this.dbManager = dbManager;
    this.logger = logger;
  }

  _getRepository(collectionName) {
    return collectionName === "avatar_jobs"
      ? this.dbManager.avatarJobs
      : this.dbManager.imagineJobs;
  }

  async getAll(collectionName) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.getAll() : {};
  }

  async getByJobId(collectionName, jobId) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.getByJobId(jobId) : null;
  }

  async getByUserId(collectionName, userId, limit = 20) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.getByUserId(userId, limit) : [];
  }

  async save(collectionName, jobId, jobData) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.create(jobId, jobData) : false;
  }

  async update(collectionName, jobId, jobData) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.update(jobId, jobData) : false;
  }

  async delete(collectionName, jobId) {
    const repository = this._getRepository(collectionName);
    return repository ? await repository.delete(jobId) : false;
  }

  async deleteByUserId(collectionName, userId) {
    const repository = this._getRepository(collectionName);
    if (repository) {
      try {
        const result = await repository.collection.deleteMany({ userId });
        repository.cache.clear();
        return result.deletedCount || 0;
      } catch (error) {
        this.logger.error(
          `Failed to delete jobs for user ${userId} from ${collectionName}`,
          error,
        );
        return 0;
      }
    }
    return 0;
  }

  async cleanup(collectionName, daysToKeep = 7) {
    const repository = this._getRepository(collectionName);
    if (repository) {
      const expiredCount = await repository.deleteExpired();
      const oldCount = await repository.deleteOld(daysToKeep);
      return expiredCount + oldCount;
    }
    return 0;
  }
}
