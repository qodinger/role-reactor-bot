import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

// ============================================================================
// CORE CREDIT UTILITIES
// ============================================================================

/**
 * Gets or creates user data from core credits storage
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data object
 */
export async function getUserData(userId) {
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
}

/**
 * Saves user data to core credits storage
 * @param {string} userId - User ID
 * @param {Object} userData - User data to save
 * @returns {Promise<void>}
 */
export async function saveUserData(userId, userData) {
  const storage = await getStorageManager();
  const coreCredits = (await storage.get("core_credit")) || {};

  coreCredits[userId] = userData;
  await storage.set("core_credit", coreCredits);
}

/**
 * Calculates credits from donation amount
 * @param {number} amount - Donation amount in USD
 * @returns {number} Credits to add
 */
export function calculateCreditsFromDonation(amount) {
  // $0.05 per credit (20 credits per $1)
  return Math.floor(amount / 0.05);
}

/**
 * Gets monthly credits for Core tier
 * @param {string} tier - Core tier name
 * @returns {number} Monthly credits
 */
export function getMonthlyCreditsForTier(tier) {
  const tierCredits = {
    "Core Basic": 50,
    "Core Premium": 100,
    "Core Elite": 200,
  };

  return tierCredits[tier] || 50; // Default to Basic tier credits
}

// ============================================================================
// VERIFICATION TRACKING
// ============================================================================

/**
 * Adds a verification record to user data
 * @param {Object} userData - User data object
 * @param {Object} verification - Verification details
 * @returns {Object} Updated user data
 */
export function addVerificationRecord(userData, verification) {
  const updatedUserData = { ...userData };

  updatedUserData.verifications = updatedUserData.verifications || [];
  updatedUserData.verifications.push({
    ...verification,
    verifiedAt: new Date().toISOString(),
  });

  updatedUserData.lastUpdated = new Date().toISOString();

  return updatedUserData;
}

/**
 * Creates a verification record object
 * @param {string} type - Verification type (donation, subscription, manual)
 * @param {Object} params - Verification parameters
 * @returns {Object} Verification record
 */
export function createVerificationRecord(type, params) {
  const baseRecord = {
    type,
    verifiedBy: params.verifiedBy,
    notes: params.notes || null,
  };

  switch (type) {
    case "donation":
      return {
        ...baseRecord,
        amount: params.amount,
        credits: params.credits,
        koFiUrl: params.koFiUrl || null,
      };

    case "subscription":
      return {
        ...baseRecord,
        amount: 0,
        credits: params.credits,
        tier: params.tier,
        koFiUrl: params.koFiUrl || null,
      };

    case "manual":
      return {
        ...baseRecord,
        amount: 0,
        credits: params.credits,
        koFiUrl: null,
      };

    default:
      return baseRecord;
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates donation amount
 * @param {number} amount - Donation amount
 * @returns {Object} Validation result
 */
export function validateDonationAmount(amount) {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a valid number" };
  }

  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  if (amount > 10000) {
    return { valid: false, error: "Amount cannot exceed $10,000" };
  }

  return { valid: true };
}

/**
 * Validates credit amount for manual addition
 * @param {number} credits - Credit amount
 * @returns {Object} Validation result
 */
export function validateCreditAmount(credits) {
  if (typeof credits !== "number" || isNaN(credits)) {
    return { valid: false, error: "Credits must be a valid number" };
  }

  if (credits <= 0) {
    return { valid: false, error: "Credits must be greater than 0" };
  }

  if (credits > 1000) {
    return { valid: false, error: "Credits cannot exceed 1,000" };
  }

  return { valid: true };
}

/**
 * Validates Ko-fi URL format
 * @param {string} url - Ko-fi URL
 * @returns {Object} Validation result
 */
export function validateKoFiUrl(url) {
  if (!url) {
    return { valid: true }; // Optional field
  }

  const koFiUrlPattern = /^https?:\/\/(www\.)?ko-fi\.com\/[a-zA-Z0-9_-]+/;

  if (!koFiUrlPattern.test(url)) {
    return { valid: false, error: "Invalid Ko-fi URL format" };
  }

  return { valid: true };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handles verification errors with logging
 * @param {Error} error - Error object
 * @param {string} operation - Operation that failed
 * @param {Object} context - Additional context
 */
export function handleVerificationError(error, operation, context = {}) {
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
