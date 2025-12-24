import { getLogger } from "../logger.js";
import { getDatabaseManager } from "./databaseManager.js";
import { getStorageManager } from "./storageManager.js";

const logger = getLogger();

/**
 * Storage manager for image generation jobs (avatar_jobs, imagine_jobs)
 * Supports both file and database storage based on AI_IMAGE_JOBS_STORAGE_TYPE
 */
export class ImageJobsStorageManager {
  constructor() {
    this.storageType = process.env.AI_IMAGE_JOBS_STORAGE_TYPE || "file"; // file (default) or mongodb
    this.dbManager = null;
    this.storageManager = null;
    this.isInitialized = false;
  }

  /**
   * Initialize storage based on configuration
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      if (this.storageType === "mongodb") {
        this.dbManager = await getDatabaseManager();
        if (
          !this.dbManager ||
          !this.dbManager.connectionManager ||
          !this.dbManager.connectionManager.db
        ) {
          logger.warn(
            "⚠️ MongoDB not available for image jobs, falling back to file storage",
          );
          this.storageType = "file";
        } else {
          logger.info("✅ Using MongoDB for image jobs storage");
        }
      }

      if (this.storageType === "file") {
        this.storageManager = await getStorageManager();
        logger.info("✅ Using file storage for image jobs");
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize image jobs storage:", error);
      // Fallback to file storage
      this.storageType = "file";
      this.storageManager = await getStorageManager();
      this.isInitialized = true;
    }
  }

  /**
   * Get all jobs for a collection
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @returns {Promise<Object>} All jobs as an object with jobId as key
   */
  async getAll(collectionName) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.getAll();
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      return (await this.storageManager.read(collectionName)) || {};
    }

    return {};
  }

  /**
   * Get a specific job by ID
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} Job data or null if not found
   */
  async getByJobId(collectionName, jobId) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.getByJobId(jobId);
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      const allJobs = (await this.storageManager.read(collectionName)) || {};
      return allJobs[jobId] || null;
    }

    return null;
  }

  /**
   * Get jobs for a specific user
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of jobs to return
   * @returns {Promise<Array>} Array of job objects
   */
  async getByUserId(collectionName, userId, limit = 20) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.getByUserId(userId, limit);
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
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

    return [];
  }

  /**
   * Save a job
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @param {Object} jobData - Job data to save
   * @returns {Promise<boolean>} True if successful
   */
  async save(collectionName, jobId, jobData) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.create(jobId, jobData);
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      const allJobs = (await this.storageManager.read(collectionName)) || {};
      allJobs[jobId] = jobData;
      await this.storageManager.write(collectionName, allJobs);
      return true;
    }

    return false;
  }

  /**
   * Update a job
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @param {Object} jobData - Job data to update
   * @returns {Promise<boolean>} True if successful
   */
  async update(collectionName, jobId, jobData) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.update(jobId, jobData);
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      const allJobs = (await this.storageManager.read(collectionName)) || {};
      if (allJobs[jobId]) {
        allJobs[jobId] = { ...allJobs[jobId], ...jobData };
        await this.storageManager.write(collectionName, allJobs);
        return true;
      }
    }

    return false;
  }

  /**
   * Delete a job
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} True if successful
   */
  async delete(collectionName, jobId) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        return await repository.delete(jobId);
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      const allJobs = (await this.storageManager.read(collectionName)) || {};
      if (allJobs[jobId]) {
        delete allJobs[jobId];
        await this.storageManager.write(collectionName, allJobs);
        return true;
      }
    }

    return false;
  }

  /**
   * Delete all jobs for a specific user
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of jobs deleted
   */
  async deleteByUserId(collectionName, userId) {
    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        try {
          const result = await repository.collection.deleteMany({ userId });
          repository.cache.clear();
          return result.deletedCount || 0;
        } catch (error) {
          logger.error(
            `Failed to delete jobs for user ${userId} from ${collectionName}`,
            error,
          );
          return 0;
        }
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
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

    return 0;
  }

  /**
   * Clean up expired jobs
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {number} daysToKeep - Days of history to keep (0 or negative = disable cleanup)
   * @returns {Promise<number>} Number of jobs cleaned up
   */
  async cleanup(collectionName, daysToKeep = 7) {
    // Disable cleanup if daysToKeep is 0 or negative
    if (daysToKeep <= 0) {
      return 0;
    }

    await this.initialize();

    if (this.storageType === "mongodb" && this.dbManager) {
      const repository =
        collectionName === "avatar_jobs"
          ? this.dbManager.avatarJobs
          : this.dbManager.imagineJobs;

      if (repository) {
        // Delete expired jobs (only if expiresAt is in the past)
        const expiredCount = await repository.deleteExpired();
        // Delete old jobs (fallback for records without expiresAt)
        const oldCount = await repository.deleteOld(daysToKeep);
        return expiredCount + oldCount;
      }
    }

    // Fallback to file storage
    if (this.storageManager) {
      const allJobs = (await this.storageManager.read(collectionName)) || {};
      const now = new Date();
      const cutoffTime = new Date(
        Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
      );
      let cleanedCount = 0;

      for (const [jobId, record] of Object.entries(allJobs)) {
        let shouldDelete = false;

        // Priority 1: Check if expiresAt is set and in the past
        if (record.expiresAt) {
          const expiresAt = new Date(record.expiresAt);
          if (expiresAt < now) {
            shouldDelete = true;
          }
        }
        // Priority 2: Fallback to createdAt for old records without expiresAt
        else if (record.createdAt) {
          const createdAt = new Date(record.createdAt);
          if (createdAt < cutoffTime) {
            shouldDelete = true;
          }
        }
        // Priority 3: Delete records with no timestamp (invalid data)
        else {
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

    return 0;
  }
}

// Singleton instance
let imageJobsStorageManager = null;

/**
 * Get the singleton instance of ImageJobsStorageManager
 * @returns {ImageJobsStorageManager}
 */
export function getImageJobsStorageManager() {
  if (!imageJobsStorageManager) {
    imageJobsStorageManager = new ImageJobsStorageManager();
  }
  return imageJobsStorageManager;
}
