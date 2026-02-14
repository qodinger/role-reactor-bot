export class FileImageJobsProvider {
  constructor(storageManager, logger) {
    this.storageManager = storageManager;
    this.logger = logger;
  }

  async getAll(collectionName) {
    return (await this.storageManager.read(collectionName)) || {};
  }

  async getByJobId(collectionName, jobId) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    return allJobs[jobId] || null;
  }

  async getByUserId(collectionName, userId, limit = 20) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    const userJobs = Object.entries(allJobs)
      .filter(([_, record]) => record.userId === userId)
      .map(([jobId, record]) => ({
        jobId,
        ...record,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return userJobs;
  }

  async save(collectionName, jobId, jobData) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    allJobs[jobId] = jobData;
    await this.storageManager.write(collectionName, allJobs);
    return true;
  }

  async update(collectionName, jobId, jobData) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    if (allJobs[jobId]) {
      allJobs[jobId] = { ...allJobs[jobId], ...jobData };
      await this.storageManager.write(collectionName, allJobs);
      return true;
    }
    return false;
  }

  async delete(collectionName, jobId) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    if (allJobs[jobId]) {
      delete allJobs[jobId];
      await this.storageManager.write(collectionName, allJobs);
      return true;
    }
    return false;
  }

  async deleteByUserId(collectionName, userId) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    let deletedCount = 0;

    for (const [jobId, record] of Object.entries(allJobs)) {
      if (record.userId === userId) {
        delete allJobs[jobId];
        deletedCount += 1;
      }
    }

    if (deletedCount > 0) {
      await this.storageManager.write(collectionName, allJobs);
    }

    return deletedCount;
  }

  async cleanup(collectionName, daysToKeep = 7) {
    const allJobs = (await this.storageManager.read(collectionName)) || {};
    const now = new Date();
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, record] of Object.entries(allJobs)) {
      let shouldDelete = false;

      if (record.expiresAt) {
        const expiresAt = new Date(record.expiresAt);
        if (expiresAt < now) {
          shouldDelete = true;
        }
      } else if (record.createdAt) {
        const createdAt = new Date(record.createdAt);
        if (createdAt < cutoffTime) {
          shouldDelete = true;
        }
      } else {
        shouldDelete = true;
      }

      if (shouldDelete) {
        delete allJobs[jobId];
        cleanedCount += 1;
      }
    }

    if (cleanedCount > 0) {
      await this.storageManager.write(collectionName, allJobs);
    }

    return cleanedCount;
  }
}
