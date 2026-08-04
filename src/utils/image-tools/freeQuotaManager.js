import { getDatabaseManager } from "../storage/databaseManager.js";
import { getLogger } from "../logger.js";
import { FREE_DAILY_QUOTA } from "../../config/imageTools.js";

const logger = getLogger();

/**
 * Get today's date key in UTC (YYYY-MM-DD).
 * Resets at UTC midnight.
 */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get the free_image_quota collection, creating the TTL index on first access.
 */
let _collection = null;
async function getCollection() {
  if (_collection) return _collection;

  const dbManager = await getDatabaseManager();
  if (!dbManager?.connectionManager?.db) {
    throw new Error("MongoDB database is not available");
  }

  const db = dbManager.connectionManager.db;
  const col = db.collection("free_image_quota");

  // TTL index: MongoDB auto-deletes documents 48 hours after `expiresAt`
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // Index for fast lookups
  await col.createIndex({ userId: 1, date: 1 }, { unique: true });

  _collection = col;
  return col;
}

export async function checkAndConsumeFreeTier(userId) {
  try {
    const col = await getCollection();
    const date = todayUTC();

    // Atomically increment the count for today using upsert.
    // By not including count in the query filter, we avoid Duplicate Key
    // errors caused by race conditions on the unique index during the first insertion.
    const result = await col.findOneAndUpdate(
      { userId, date },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          userId,
          date,
          // TTL: expire 48 hours after midnight of the tracked day
          expiresAt: new Date(
            new Date(date + "T00:00:00Z").getTime() + 48 * 60 * 60 * 1000,
          ),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result?.value ?? result; // driver v5 vs v6 compat
    const count = doc?.count ?? 1;

    // Check if they exceeded the quota
    if (count > FREE_DAILY_QUOTA) {
      // Revert the increment since they weren't allowed
      await col.updateOne({ _id: doc._id }, { $inc: { count: -1 } });
      logger.warn(
        `[FreeQuota] Quota exhausted for ${userId}. (Count was ${count})`,
      );
      return { allowed: false, wasFree: false, remaining: 0 };
    }

    const remaining = Math.max(0, FREE_DAILY_QUOTA - count);

    logger.debug(
      `[FreeQuota] userId=${userId} date=${date} count=${count} remaining=${remaining}`,
    );

    return { allowed: true, wasFree: true, remaining };
  } catch (error) {
    logger.error(
      `[FreeQuota] Error checking free tier for ${userId}:`,
      error?.message,
    );
    return { allowed: false, wasFree: false, remaining: 0 };
  }
}

/**
 * Get the user's remaining free quota for today without consuming it.
 *
 * @param {string} userId - Discord user ID
 * @returns {Promise<{ remaining: number, total: number, resetsAt: string }>}
 */
export async function getFreeQuota(userId) {
  try {
    const col = await getCollection();
    const date = todayUTC();

    const doc = await col.findOne({ userId, date });
    const used = doc?.count ?? 0;
    const remaining = Math.max(0, FREE_DAILY_QUOTA - used);

    // Next reset = midnight of tomorrow UTC
    const tomorrow = new Date(date + "T00:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return {
      remaining,
      total: FREE_DAILY_QUOTA,
      resetsAt: tomorrow.toISOString(),
    };
  } catch (error) {
    logger.error(`[FreeQuota] Failed to get quota for ${userId}:`, error);
    return { remaining: 0, total: FREE_DAILY_QUOTA, resetsAt: null };
  }
}

/**
 * Refund a free tier operation (decrement the count).
 * Useful when an operation fails after consuming quota.
 *
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>} True if refunded, false otherwise
 */
export async function refundFreeTier(userId) {
  try {
    const col = await getCollection();
    const date = todayUTC();

    // Only decrement if count is greater than 0
    const result = await col.updateOne(
      { userId, date, count: { $gt: 0 } },
      { $inc: { count: -1 } },
    );

    if (result.modifiedCount > 0) {
      logger.debug(`[FreeQuota] Refunded 1 free operation for ${userId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`[FreeQuota] Error refunding free tier for ${userId}:`, error);
    return false;
  }
}
