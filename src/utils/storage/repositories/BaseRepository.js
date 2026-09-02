/**
 * Base repository class for MongoDB collections
 * Provides common functionality for all repositories
 */
import { getPerformanceMonitor } from "../../monitoring/performanceMonitor.js";

const COMMON_METHODS = new Set([
  "findOne",
  "updateOne",
  "updateMany",
  "insertOne",
  "insertMany",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "countDocuments",
]);

export class BaseRepository {
  constructor(db, collectionName, cache, logger) {
    this.db = db;
    this.collection = this._instrumentCollection(db.collection(collectionName));
    this.cache = cache;
    this.logger = logger;
  }

  /**
   * Instrument the collection methods to record performance metrics
   * @param {object} collection - MongoDB collection
   * @returns {object} Proxied collection
   */
  _instrumentCollection(collection) {
    return new Proxy(collection, {
      get: (target, prop) => {
        const originalAction = target[prop];
        if (
          typeof prop === "string" &&
          COMMON_METHODS.has(prop) &&
          typeof originalAction === "function"
        ) {
          const action = originalAction.bind(target);
          return async (...args) => {
            const start = Date.now();
            try {
              const result = await action(...args);
              const duration = Date.now() - start;
              getPerformanceMonitor().recordDatabaseOperation(
                duration,
                duration > 1000,
              );
              return result;
            } catch (error) {
              try {
                getPerformanceMonitor().recordDatabaseOperation(
                  Date.now() - start,
                  false,
                  true,
                );
              } catch (_perfError) {}

              throw error;
            }
          };
        }
        return originalAction;
      },
    });
  }
}
