/**
 * Base repository class for MongoDB collections
 * Provides common functionality for all repositories
 */
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
    const commonMethods = [
      "findOne",
      "updateOne",
      "updateMany",
      "insertOne",
      "insertMany",
      "deleteOne",
      "deleteMany",
      "replaceOne",
      "countDocuments",
    ];

    return new Proxy(collection, {
      get: (target, prop) => {
        const originalAction = target[prop];
        if (
          typeof prop === "string" &&
          commonMethods.includes(prop) &&
          typeof originalAction === "function"
        ) {
          return async (...args) => {
            const start = Date.now();
            try {
              const result = await originalAction.apply(target, args);
              const duration = Date.now() - start;

              const { getPerformanceMonitor } = await import(
                "../../monitoring/performanceMonitor.js"
              );
              getPerformanceMonitor().recordDatabaseOperation(
                duration,
                duration > 1000,
              );

              return result;
            } catch (error) {
              const duration = Date.now() - start;

              try {
                const { getPerformanceMonitor } = await import(
                  "../../monitoring/performanceMonitor.js"
                );
                getPerformanceMonitor().recordDatabaseOperation(
                  duration,
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
