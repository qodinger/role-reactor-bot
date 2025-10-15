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
        isCore: false,
        coreTier: null,
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
      isCore: false,
      coreTier: null,
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
  if (userData.isCore && userData.coreTier) {
    return `${emojiConfig.getTierBadge(userData.coreTier)} ${userData.coreTier}`;
  } else if (userData.isCore) {
    return `${customEmojis.core} Core Member`;
  } else {
    return "Regular";
  }
}

/**
 * Gets Core pricing information
 * @returns {Object} Pricing information object
 */
export function getCorePricing() {
  return {
    donations: {
      $10: 100,
      $25: 250,
      $50: 500,
    },
    subscriptions: {
      "Core Basic": { price: "$10/mo", credits: 150 },
      "Core Premium": { price: "$25/mo", credits: 400 },
      "Core Elite": { price: "$50/mo", credits: 850 },
    },
    benefits: ["Priority processing", "Monthly bonuses", "Better value"],
  };
}

/**
 * Calculates credit value from donation amount
 * @param {number} amount - Donation amount in USD
 * @returns {number} Credits earned
 */
export function calculateCreditsFromDonation(amount) {
  // $0.10 per credit (10 credits per $1)
  return Math.floor(amount / 0.1);
}

/**
 * Gets monthly credits for Core tier
 * @param {string} tier - Core tier name
 * @returns {number} Monthly credits
 */
export function getMonthlyCreditsForTier(tier) {
  const tierCredits = {
    "Core Basic": 150,
    "Core Premium": 400,
    "Core Elite": 850,
  };

  return tierCredits[tier] || 150; // Default to Basic tier credits
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

  const requiredFields = ["credits", "isCore", "totalGenerated", "lastUpdated"];
  for (const field of requiredFields) {
    if (!(field in userData)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (typeof userData.credits !== "number" || userData.credits < 0) {
    return { valid: false, error: "Credits must be a non-negative number" };
  }

  if (typeof userData.isCore !== "boolean") {
    return { valid: false, error: "isCore must be a boolean" };
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

/**
 * Creates a standardized error response
 * @param {string} operation - Operation that failed
 * @param {Error} error - Error object
 * @returns {Object} Error response
 */
export function createErrorResponse(operation, error) {
  return {
    success: false,
    error: error.message,
    operation,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Measures operation duration
 * @param {number} startTime - Start timestamp
 * @param {string} operation - Operation name
 * @param {string} username - Username for logging
 * @returns {number} Duration in milliseconds
 */
export function logOperationDuration(startTime, operation, username) {
  const duration = Date.now() - startTime;
  logger.info(`${operation} completed in ${duration}ms for ${username}`);
  return duration;
}

/**
 * Creates a performance context object
 * @param {string} operation - Operation name
 * @param {string} username - Username
 * @param {string} userId - User ID
 * @returns {Object} Performance context
 */
export function createPerformanceContext(operation, username, userId) {
  return {
    startTime: Date.now(),
    operation,
    username,
    userId,
  };
}
