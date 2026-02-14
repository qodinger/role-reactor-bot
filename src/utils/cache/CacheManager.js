/**
 * Enhanced cache manager with TTL and size limits
 */
export class CacheManager {
  constructor(timeout = 5 * 60 * 1000, maxSize = 1000) {
    this.cache = new Map();
    this.timeout = timeout;
    this.maxSize = maxSize;
    this.accessOrder = []; // Track access order for LRU eviction
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.timeout) {
      this.delete(key);
      return null;
    }

    this.updateAccessOrder(key);
    return cached.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    this.updateAccessOrder(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  updateAccessOrder(key) {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  evictOldest() {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.timeout) {
        this.delete(key);
      }
    }
  }
}
