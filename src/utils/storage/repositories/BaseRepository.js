/**
 * Base repository class for MongoDB collections
 * Provides common functionality for all repositories
 */
export class BaseRepository {
  constructor(db, collectionName, cache, logger) {
    this.db = db;
    this.collection = db.collection(collectionName);
    this.cache = cache;
    this.logger = logger;
  }
}
