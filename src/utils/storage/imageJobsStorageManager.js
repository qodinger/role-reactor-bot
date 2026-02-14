import { getLogger } from "../logger.js";
import { getDatabaseManager } from "./databaseManager.js";
import { getStorageManager } from "./storageManager.js";
import { FileImageJobsProvider } from "./FileImageJobsProvider.js";
import { DatabaseImageJobsProvider } from "./DatabaseImageJobsProvider.js";

const logger = getLogger();

/**
 * Storage manager for image generation jobs (avatar_jobs, imagine_jobs)
 * Supports both file and database storage based on AI_IMAGE_JOBS_STORAGE_TYPE
 */
export class ImageJobsStorageManager {
  constructor() {
    this.storageType = process.env.AI_IMAGE_JOBS_STORAGE_TYPE || "file"; // file (default) or mongodb
    this.provider = null;
    this.isInitialized = false;
  }

  /**
   * Initialize storage based on configuration
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      if (this.storageType === "mongodb") {
        const dbManager = await getDatabaseManager();
        if (
          !dbManager ||
          !dbManager.connectionManager ||
          !dbManager.connectionManager.db
        ) {
          logger.warn(
            "⚠️ MongoDB not available for image jobs, falling back to file storage",
          );
          this.storageType = "file";
        } else {
          this.provider = new DatabaseImageJobsProvider(dbManager, logger);
          logger.info("✅ Using MongoDB for image jobs storage");
        }
      }

      if (this.storageType === "file") {
        const storageManager = await getStorageManager();
        this.provider = new FileImageJobsProvider(storageManager, logger);
        logger.info("✅ Using file storage for image jobs");
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize image jobs storage:", error);
      // Fallback to file storage
      this.storageType = "file";
      const storageManager = await getStorageManager();
      this.provider = new FileImageJobsProvider(storageManager, logger);
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
    return await this.provider.getAll(collectionName);
  }

  /**
   * Get a specific job by ID
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} Job data or null if not found
   */
  async getByJobId(collectionName, jobId) {
    await this.initialize();
    return await this.provider.getByJobId(collectionName, jobId);
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
    return await this.provider.getByUserId(collectionName, userId, limit);
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
    return await this.provider.save(collectionName, jobId, jobData);
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
    return await this.provider.update(collectionName, jobId, jobData);
  }

  /**
   * Delete a job
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} True if successful
   */
  async delete(collectionName, jobId) {
    await this.initialize();
    return await this.provider.delete(collectionName, jobId);
  }

  /**
   * Delete all jobs for a specific user
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of jobs deleted
   */
  async deleteByUserId(collectionName, userId) {
    await this.initialize();
    return await this.provider.deleteByUserId(collectionName, userId);
  }

  /**
   * Clean up expired jobs
   * @param {string} collectionName - Collection name (avatar_jobs or imagine_jobs)
   * @param {number} daysToKeep - Days of history to keep (0 or negative = disable cleanup)
   * @returns {Promise<number>} Number of jobs cleaned up
   */
  async cleanup(collectionName, daysToKeep = 7) {
    if (daysToKeep <= 0) return 0;
    await this.initialize();
    return await this.provider.cleanup(collectionName, daysToKeep);
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

export { FileImageJobsProvider, DatabaseImageJobsProvider };
