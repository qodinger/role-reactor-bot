/**
 * Query cache for frequently accessed data
 */
export class QueryCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 2 * 60 * 1000; // 2 minutes for query results
    this.maxSize = 500;
  }

  get(queryKey) {
    const entry = this.cache.get(queryKey);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(queryKey);
      return null;
    }

    return entry.data;
  }

  set(queryKey, data) {
    if (this.cache.size >= this.maxSize) {
      // Simple FIFO eviction
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(queryKey, {
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }

  /**
   * Invalidate cache for specific collection
   * @param {string} collectionName
   */
  invalidateCollection(collectionName) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${collectionName}:`)) {
        this.cache.delete(key);
      }
    }
  }
}
