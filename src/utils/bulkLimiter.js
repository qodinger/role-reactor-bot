import { getLogger } from "./logger.js";

const logger = getLogger();

/**
 * Global Bulk Operation Limiter
 *
 * Prevents VPS overload by limiting the number of concurrent bulk operations
 * (role assignments, scheduled role processing, etc.) across all guilds.
 *
 * Two separate pools ensure Pro servers never wait behind free servers:
 *   - FREE pool:  max 3 concurrent operations
 *   - PRO pool:   max 2 concurrent operations (reserved for Pro Engine guilds)
 *
 * Operations that exceed the concurrency limit wait in a FIFO queue.
 * If the wait exceeds the timeout, the operation is rejected gracefully.
 */

const POOL_CONFIG = {
  free: { maxConcurrent: 3, timeoutMs: 30_000 },
  pro: { maxConcurrent: 2, timeoutMs: 30_000 },
};

/**
 * @typedef {Object} Pool
 * @property {number} active
 * @property {Array<{ resolve: Function, reject: Function, guildId: string }>} queue
 */

/** @type {Record<string, Pool>} */
const pools = {
  free: { active: 0, queue: [] },
  pro: { active: 0, queue: [] },
};

/**
 * Acquire a slot for a bulk operation.
 * Pro servers use a separate reserved pool so they never queue behind free servers.
 *
 * @param {string} guildId - Guild ID (for logging)
 * @param {Object} [options] - Options
 * @param {boolean} [options.isPro=false] - Whether the guild has Pro Engine
 * @returns {Promise<Function>} A release function — call it when the operation finishes
 */
export function acquireBulkSlot(guildId, options = {}) {
  const poolKey = options.isPro ? "pro" : "free";
  const pool = pools[poolKey];
  const config = POOL_CONFIG[poolKey];
  const label = options.isPro ? "Pro" : "Free";

  // Slot available immediately
  if (pool.active < config.maxConcurrent) {
    pool.active++;
    logger.debug(
      `[${label}] Bulk slot acquired for guild ${guildId} (${pool.active}/${config.maxConcurrent} active)`,
    );
    return Promise.resolve(createRelease(guildId, poolKey));
  }

  // All slots busy — queue the request
  logger.info(
    `[${label}] Bulk operation for guild ${guildId} queued (${pool.active}/${config.maxConcurrent} active, ${pool.queue.length + 1} waiting)`,
  );

  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, guildId };
    pool.queue.push(entry);

    // Timeout: reject if we wait too long
    const timer = setTimeout(() => {
      const index = pool.queue.indexOf(entry);
      if (index !== -1) {
        pool.queue.splice(index, 1);
        logger.warn(
          `[${label}] Bulk operation for guild ${guildId} timed out in queue after ${config.timeoutMs}ms`,
        );
        reject(new BulkQueueTimeoutError(guildId));
      }
    }, config.timeoutMs);

    // Override resolve to clear the timer
    entry.resolve = releaseFunc => {
      clearTimeout(timer);
      resolve(releaseFunc);
    };
  });
}

/**
 * Create a release function for a slot
 * @param {string} guildId
 * @param {string} poolKey
 * @returns {Function}
 */
function createRelease(guildId, poolKey) {
  const pool = pools[poolKey];
  const config = POOL_CONFIG[poolKey];
  const label = poolKey === "pro" ? "Pro" : "Free";
  let released = false;

  return () => {
    if (released) return; // Prevent double-release
    released = true;
    pool.active--;

    logger.debug(
      `[${label}] Bulk slot released for guild ${guildId} (${pool.active}/${config.maxConcurrent} active, ${pool.queue.length} waiting)`,
    );

    // Wake up the next queued operation
    if (pool.queue.length > 0) {
      const next = pool.queue.shift();
      pool.active++;
      logger.info(
        `[${label}] Bulk slot granted to queued guild ${next.guildId} (${pool.active}/${config.maxConcurrent} active)`,
      );
      next.resolve(createRelease(next.guildId, poolKey));
    }
  };
}

/**
 * Custom error for queue timeout — allows handlers to show a friendly message
 */
export class BulkQueueTimeoutError extends Error {
  /**
   * @param {string} guildId
   */
  constructor(guildId) {
    super(
      `Bulk operation for guild ${guildId} timed out waiting for an available slot.`,
    );
    this.name = "BulkQueueTimeoutError";
    this.guildId = guildId;
  }
}

/**
 * Get current limiter stats (for health/monitoring endpoints)
 * @returns {{ free: { active: number, queued: number, max: number }, pro: { active: number, queued: number, max: number } }}
 */
export function getBulkLimiterStats() {
  return {
    free: {
      active: pools.free.active,
      queued: pools.free.queue.length,
      max: POOL_CONFIG.free.maxConcurrent,
    },
    pro: {
      active: pools.pro.active,
      queued: pools.pro.queue.length,
      max: POOL_CONFIG.pro.maxConcurrent,
    },
  };
}
