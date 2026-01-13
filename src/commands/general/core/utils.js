import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";
import { emojiConfig } from "../../../config/emojis.js";

const logger = getLogger();
const { customEmojis } = emojiConfig;

// ============================================================================
// CORE CREDIT UTILITIES
// ============================================================================

/**
 * Gets user data from core credits storage with default values
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data object
 */
export async function getUserData(userId) {
  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    return (
      coreCredits[userId] || {
        credits: 0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        verifications: [],
      }
    );
  } catch (error) {
    logger.error("Error getting user data:", error);
    // Return default data on error
    return {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      verifications: [],
    };
  }
}

/**
 * Formats user tier display with proper badge emoji
 * @param {Object} userData - User data object
 * @returns {string} Formatted tier display
 */
export function formatTierDisplay(userData) {
  // Since we simplified the system, just show "Regular" for now
  // This can be enhanced later when subscription tiers are added
  return "Regular";
}

/**
 * Gets Core pricing information
 * Note: Only one-time crypto payments are supported (subscriptions removed)
 * Uses centralized config for all pricing values
 * @returns {Promise<Object>} Pricing information object
 */
export async function getCorePricing() {
  // Load config for all pricing values
  const configModule = await import("../../../config/config.js").catch(
    () => null,
  );
  const config =
    configModule?.config || configModule?.default || configModule || {};
  const corePricing = config.corePricing || {};

  // Load AI feature credits for benefits calculation
  const aiConfigModule = await import("../../../config/ai.js").catch(
    () => null,
  );
  const getAIFeatureCosts =
    aiConfigModule?.getAIFeatureCosts ||
    aiConfigModule?.default?.getAIFeatureCosts;
  // Get feature credits from config
  let featureCosts = getAIFeatureCosts
    ? typeof getAIFeatureCosts === "function"
      ? getAIFeatureCosts()
      : getAIFeatureCosts
    : null;

  // Ensure feature credits come from config
  if (!featureCosts) {
    const { getAIFeatureCosts: getCosts } = await import("../../config/ai.js");
    featureCosts = getCosts();
  }
  const aiChatCost = featureCosts?.aiChat;

  // Ensure packages come from config
  if (!corePricing.packages) {
    throw new Error("Core pricing packages not found in config");
  }

  return {
    packages: corePricing.packages,
    benefits: [
      "Never expires",
      "Instant delivery",
      "Secure crypto payments",
      "Flexible usage (chat + images)",
      "Transferable (gift to others)",
      `1 Core = ${Math.floor(1 / aiChatCost)} AI requests`, // Uses config value
    ],
  };
}

/**
 * Get priority score for Core tier
 * Higher score = higher priority
 * Elite: 3, Premium: 2, Basic: 1, None: 0
 * @param {string|null} tier - Core tier name
 * @returns {number} Priority score (0-3)
 */
export function getCoreTierPriority(tier) {
  if (!tier) return 0;
  const tierPriorities = {
    "Core Elite": 3,
    "Core Premium": 2,
    "Core Basic": 1,
  };
  return tierPriorities[tier] || 0;
}

/**
 * Get rate limit multiplier for Core tier
 * @param {string|null} tier - Core tier name
 * @returns {number} Multiplier (1.0 for regular, 1.5 for Basic, 2.0 for Premium, 3.0 for Elite)
 */
export function getCoreRateLimitMultiplier(tier) {
  if (!tier) return 1.0;
  const tierMultipliers = {
    "Core Elite": 3.0,
    "Core Premium": 2.0,
    "Core Basic": 1.5,
  };
  return tierMultipliers[tier] || 1.0;
}

/**
 * Get user limit for Core tier (e.g., MAX_USERS for commands)
 * @param {string|null} tier - Core tier name
 * @param {number} baseLimit - Base limit for regular users
 * @returns {number} User limit for Core members
 */
export function getCoreUserLimit(tier, baseLimit) {
  if (!tier) return baseLimit;
  const tierMultipliers = {
    "Core Elite": 5.0, // 50 users for Elite (10 * 5)
    "Core Premium": 2.5, // 25 users for Premium (10 * 2.5)
    "Core Basic": 1.5, // 15 users for Basic (10 * 1.5)
  };
  const multiplier = tierMultipliers[tier] || 1.0;
  return Math.floor(baseLimit * multiplier);
}

/**
 * Get bulk member limit for Core tier (e.g., MAX_ALL_MEMBERS)
 * @param {string|null} tier - Core tier name
 * @param {number} baseLimit - Base limit for regular users
 * @returns {number} Bulk member limit for Core members
 */
export function getCoreBulkMemberLimit(tier, baseLimit) {
  if (!tier) return baseLimit;
  const tierMultipliers = {
    "Core Elite": 5.0, // 2,500 members for Elite (500 * 5)
    "Core Premium": 2.5, // 1,250 members for Premium (500 * 2.5)
    "Core Basic": 1.5, // 750 members for Basic (500 * 1.5)
  };
  const multiplier = tierMultipliers[tier] || 1.0;
  return Math.floor(baseLimit * multiplier);
}

/**
 * Get Core priority for a single user
 * @param {string} userId - User ID to check
 * @param {Object} logger - Logger instance (optional)
 * @returns {Promise<{hasCore: boolean, tier: string|null, priority: number}>}
 */
export async function getUserCorePriority(userId, logger = null) {
  try {
    if (!userId) {
      return { hasCore: false, tier: null, priority: 0 };
    }

    const userData = await getUserData(userId);
    // Since we simplified to Core packages only, all users are "Regular"
    // Priority is now based on credit balance instead of tiers
    const hasCredits = userData.credits > 0;
    
    return {
      hasCore: hasCredits,
      tier: hasCredits ? "Core Package User" : null,
      priority: hasCredits ? 1 : 0, // Simple: 1 if has credits, 0 if not
    };
  } catch (error) {
    if (logger) {
      logger.debug(
        `Failed to check Core status for user ${userId}:`,
        error.message,
      );
    }
    return { hasCore: false, tier: null, priority: 0 };
  }
}

/**
 * Get Core priority for multiple users (returns highest priority)
 * @param {Array<string>} userIds - Array of user IDs to check
 * @param {Object} options - Options
 * @param {number} options.maxUsers - Maximum number of users to check (default: 10)
 * @param {Object} options.logger - Logger instance (optional)
 * @returns {Promise<{hasCore: boolean, maxTier: string|null, priority: number}>}
 */
export async function getUsersCorePriority(userIds, options = {}) {
  const { maxUsers = 10, logger = null } = options;

  try {
    if (!userIds || userIds.length === 0) {
      return { hasCore: false, maxTier: null, priority: 0 };
    }

    const usersToCheck = userIds.slice(0, maxUsers);
    let maxPriority = 0;
    let maxTier = null;

    for (const userId of usersToCheck) {
      try {
        const userPriority = await getUserCorePriority(userId, logger);
        if (userPriority.hasCore && userPriority.priority > maxPriority) {
          maxPriority = userPriority.priority;
          maxTier = userPriority.tier;
        }
      } catch (error) {
        if (logger) {
          logger.debug(
            `Failed to check Core status for user ${userId}:`,
            error.message,
          );
        }
      }
    }

    return {
      hasCore: maxPriority > 0,
      maxTier,
      priority: maxPriority,
    };
  } catch (error) {
    if (logger) {
      logger.error("Error checking Core priority for users:", error);
    }
    return { hasCore: false, maxTier: null, priority: 0 };
  }
}

/**
 * Sort items by Core priority (higher priority first)
 * @param {Array} items - Array of items with priority property
 * @param {string} idKey - Key to use for tie-breaker sorting (default: 'id')
 * @returns {Array} Sorted items
 */
export function sortByCorePriority(items, idKey = "id") {
  return items.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    // Consistent tie-breaker using ID
    // Support nested structures like { schedule: { id: ... } } or { poll: { id: ... } }
    let aId = a[idKey];
    let bId = b[idKey];

    // Handle dot notation (e.g., "poll.id", "schedule.id")
    if (idKey.includes(".")) {
      const [parentKey, childKey] = idKey.split(".");
      if (a[parentKey]) aId = a[parentKey][childKey];
      if (b[parentKey]) bId = b[parentKey][childKey];
    }

    // Handle nested structures
    if (!aId && a.schedule) aId = a.schedule[idKey];
    if (!aId && a.poll) aId = a.poll[idKey];
    if (!bId && b.schedule) bId = b.schedule[idKey];
    if (!bId && b.poll) bId = b.poll[idKey];

    // If still no ID, try direct access on item
    if (!aId && a.item) aId = a.item[idKey];
    if (!bId && b.item) bId = b.item[idKey];

    if (aId && bId) {
      return String(aId).localeCompare(String(bId));
    }
    return 0;
  });
}

/**
 * Log priority distribution
 * @param {Array} itemsWithPriority - Array of items with priority and tier
 * @param {number} totalItems - Total number of items
 * @param {string} itemType - Type of items (e.g., "schedules", "polls")
 * @param {Object} logger - Logger instance
 */
export function logPriorityDistribution(
  itemsWithPriority,
  totalItems,
  itemType,
  logger,
) {
  const coreCount = itemsWithPriority.filter(item => item.priority > 0).length;
  if (coreCount > 0) {
    const eliteCount = itemsWithPriority.filter(
      item => item.tier === "Core Elite",
    ).length;
    const premiumCount = itemsWithPriority.filter(
      item => item.tier === "Core Premium",
    ).length;
    const basicCount = itemsWithPriority.filter(
      item => item.tier === "Core Basic",
    ).length;

    logger.info(
      `🎯 Prioritized ${coreCount}/${totalItems} ${itemType} with Core members (Elite: ${eliteCount}, Premium: ${premiumCount}, Basic: ${basicCount})`,
    );
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates user ID format
 * @param {string} userId - User ID to validate
 * @returns {Object} Validation result
 */
export function validateUserId(userId) {
  if (!userId) {
    return { valid: false, error: "User ID is required" };
  }

  if (typeof userId !== "string") {
    return { valid: false, error: "User ID must be a string" };
  }

  // Discord user ID format: 17-19 digits
  const discordIdPattern = /^\d{17,19}$/;
  if (!discordIdPattern.test(userId)) {
    return { valid: false, error: "Invalid Discord user ID format" };
  }

  return { valid: true };
}

/**
 * Validates user data structure
 * @param {Object} userData - User data to validate
 * @returns {Object} Validation result
 */
export function validateUserData(userData) {
  if (!userData || typeof userData !== "object") {
    return { valid: false, error: "User data must be an object" };
  }

  const requiredFields = ["credits", "totalGenerated", "lastUpdated"];
  for (const field of requiredFields) {
    if (!(field in userData)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (typeof userData.credits !== "number" || userData.credits < 0) {
    return { valid: false, error: "Credits must be a non-negative number" };
  }

  if (
    typeof userData.totalGenerated !== "number" ||
    userData.totalGenerated < 0
  ) {
    return {
      valid: false,
      error: "totalGenerated must be a non-negative number",
    };
  }

  return { valid: true };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handles core command errors with logging
 * @param {Error} error - Error object
 * @param {string} operation - Operation that failed
 * @param {Object} context - Additional context
 */
export function handleCoreError(error, operation, context = {}) {
  logger.error(`Error in ${operation}:`, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Measures operation duration and logs it
 * @param {number} startTime - Start timestamp (from Date.now())
 * @param {string} operation - Operation name for logging
 * @param {string} username - Username for logging
 * @returns {number} Duration in milliseconds
 */
export function logOperationDuration(startTime, operation, username) {
  const duration = Date.now() - startTime;
  logger.info(`${operation} completed in ${duration}ms for ${username}`);
  return duration;
}

/**
 * Creates a performance context object for tracking command execution
 * @param {string} operation - Operation name
 * @param {string} username - Username
 * @param {string} userId - User ID
 * @returns {Object} Performance context with startTime, operation, username, userId
 */
export function createPerformanceContext(operation, username, userId) {
  return {
    startTime: Date.now(),
    operation,
    username,
    userId,
  };
}
