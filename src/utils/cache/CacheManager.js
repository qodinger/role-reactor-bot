/**
 * Enhanced cache manager with TTL and size limits
 * Uses Map insertion-order for O(1) LRU eviction
 */
export class CacheManager {
  constructor(timeout = 5 * 60 * 1000, maxSize = 1000) {
    this.cache = new Map();
    this.timeout = timeout;
    this.maxSize = maxSize;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    // O(1) LRU touch: re-insert so the key becomes most-recently-used
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached.data;
  }

  /**
   * @param {string} key
   * @param {*} data
   * @param {number} [ttl] Optional per-entry TTL in ms (defaults to manager timeout)
   */
  set(key, data, ttl) {
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.delete(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout: ttl || this.timeout,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  /**
   * Invalidate all cache entries whose keys start with the given prefix
   * @param {string} prefix
   */
  invalidatePrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  evictOldest() {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.timeout) {
        this.cache.delete(key);
      }
    }
  }
}
