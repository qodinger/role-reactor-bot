import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * AI Credit Manager
 * Handles credit checks and deductions for AI features
 * Uses centralized config for pricing
 * Implements atomic operations with locking to prevent race conditions
 */

let chatConfigCache = null;
let imageConfigCache = null;
const DEFAULT_CREDITS_PER_CHAT = 0.05;
const DEFAULT_CREDITS_PER_IMAGE = 2;

// In-memory locks to prevent race conditions in credit operations
// Maps userId -> Promise that resolves when lock is released
const creditLocks = new Map();

/**
 * Execute an operation with a per-user lock to prevent race conditions
 * @param {string} userId - User ID
 * @param {Function} operation - Async operation to execute
 * @returns {Promise<any>} Result of the operation
 */
async function withCreditLock(userId, operation) {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Invalid userId: must be a non-empty string");
  }

  while (creditLocks.has(userId)) {
    try {
      await creditLocks.get(userId);
    } catch {
      // Ignore errors from previous operations
    }
  }

  const lockPromise = (async () => {
    try {
      return await operation();
    } finally {
      creditLocks.delete(userId);
    }
  })();

  creditLocks.set(userId, lockPromise);

  return lockPromise;
}

async function getConfig() {
  if (chatConfigCache !== null && imageConfigCache !== null) {
    return { aiChat: chatConfigCache, aiImage: imageConfigCache };
  }

  try {
    // Try new AI config first
    const aiConfigModule = await import("../../config/ai.js").catch(() => null);
    if (aiConfigModule) {
      const getFeatureCosts =
        aiConfigModule.getAIFeatureCosts ||
        aiConfigModule.default?.getAIFeatureCosts;
      if (getFeatureCosts) {
        const featureCosts =
          typeof getFeatureCosts === "function"
            ? getFeatureCosts()
            : getFeatureCosts;
        const chatValue = featureCosts?.aiChat;
        const imageValue = featureCosts?.aiImage;

        if (typeof chatValue === "number" && chatValue > 0) {
          chatConfigCache = chatValue;
        } else {
          chatConfigCache = DEFAULT_CREDITS_PER_CHAT;
        }

        if (typeof imageValue === "number" && imageValue > 0) {
          imageConfigCache = imageValue;
        } else {
          imageConfigCache = DEFAULT_CREDITS_PER_IMAGE;
        }

        return { aiChat: chatConfigCache, aiImage: imageConfigCache };
      }
    }

    // Fallback to old config location for backward compatibility
    const configModule = await import("../../config/config.js").catch(
      () => null,
    );

    if (configModule) {
      const config = configModule.default || configModule;
      const chatValue = config?.corePricing?.featureCosts?.aiChat;
      const imageValue = config?.corePricing?.featureCosts?.aiImage;

      if (typeof chatValue === "number" && chatValue > 0) {
        chatConfigCache = chatValue;
      } else {
        chatConfigCache = DEFAULT_CREDITS_PER_CHAT;
      }

      if (typeof imageValue === "number" && imageValue > 0) {
        imageConfigCache = imageValue;
      } else {
        imageConfigCache = DEFAULT_CREDITS_PER_IMAGE;
      }

      return { aiChat: chatConfigCache, aiImage: imageConfigCache };
    }
  } catch (error) {
    logger.debug("Failed to load config, using defaults:", error);
  }

  chatConfigCache = DEFAULT_CREDITS_PER_CHAT;
  imageConfigCache = DEFAULT_CREDITS_PER_IMAGE;
  return { aiChat: chatConfigCache, aiImage: imageConfigCache };
}

function getCreditsPerRequestValue() {
  return chatConfigCache ?? DEFAULT_CREDITS_PER_CHAT;
}

function getCreditsPerImageValue() {
  return imageConfigCache ?? DEFAULT_CREDITS_PER_IMAGE;
}

/**
 * Validate userId format (Discord snowflake)
 * @param {string} userId - User ID to validate
 * @returns {boolean} True if valid
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== "string") {
    return false;
  }
  // Discord snowflakes are 17-19 digit numbers
  return /^\d{17,19}$/.test(userId.trim());
}

/**
 * Check if user has enough credits for AI request
 * Accounts for potential re-queries (checks for 2x cost to cover initial + re-query)
 * All users must pay Core credits for AI requests (no unlimited access)
 * @param {string} userId - User ID
 * @returns {Promise<{hasCredits: boolean, credits: number, creditsNeeded: number, isCoreMember: boolean}>}
 */
export async function checkAICredits(userId) {
  try {
    // Validate input
    if (!validateUserId(userId)) {
      logger.warn(`Invalid userId format: ${userId}`);
      return {
        hasCredits: false,
        credits: 0,
        creditsNeeded: getCreditsPerRequestValue(),
        isCoreMember: false,
      };
    }

    // Ensure config is loaded
    await getConfig();

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const creditData = coreCredits[userId] || {
      credits: 0,
    };

    // Check if user has enough credits for potential re-queries
    // Re-queries can happen when AI needs to fetch data or execute commands
    // Check for 2x cost to cover initial API call + potential re-query
    const creditsPerRequest = getCreditsPerRequestValue();
    const creditsNeededForReQuery = creditsPerRequest * 2; // Initial + potential re-query
    const hasEnoughCredits = creditData.credits >= creditsNeededForReQuery;

    return {
      hasCredits: hasEnoughCredits,
      credits: creditData.credits || 0,
      creditsNeeded: creditsPerRequest, // Return single request cost for display
      isCoreMember: false, // Legacy field, always false now
    };
  } catch (error) {
    logger.error("Error checking AI credits:", error);
    return {
      hasCredits: false,
      credits: 0,
      creditsNeeded: getCreditsPerRequestValue(),
      isCoreMember: false,
    };
  }
}

/**
 * Atomic check and deduct credits for AI request
 * Prevents race conditions by combining check and deduct in single locked operation
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditsRemaining: number, creditsDeducted: number, error?: string}>}
 */
export async function checkAndDeductAICredits(userId) {
  // Validate input
  if (!validateUserId(userId)) {
    logger.warn(`Invalid userId format in checkAndDeductAICredits: ${userId}`);
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      error: "Invalid user ID",
    };
  }

  return withCreditLock(userId, async () => {
    try {
      // Ensure config is loaded
      await getConfig();

      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};

      const creditData = coreCredits[userId] || {
        credits: 0,
      };

      // Check if user has enough credits
      const creditsPerRequest = getCreditsPerRequestValue();
      if (creditData.credits < creditsPerRequest) {
        return {
          success: false,
          creditsRemaining: creditData.credits || 0,
          creditsDeducted: 0,
          error: "Insufficient credits",
        };
      }

      // Deduct credits per request (atomic operation)
      creditData.credits = (creditData.credits || 0) - creditsPerRequest;
      creditData.lastUpdated = new Date().toISOString();

      // Round to 2 decimal places to avoid floating point precision issues
      creditData.credits = Math.round(creditData.credits * 100) / 100;

      coreCredits[userId] = creditData;
      await storage.set("core_credit", coreCredits);

      logger.debug(
        `User ${userId} used AI: Deducted ${creditsPerRequest} Core (${creditData.credits} remaining)`,
      );

      return {
        success: true,
        creditsRemaining: creditData.credits,
        creditsDeducted: creditsPerRequest,
      };
    } catch (error) {
      logger.error("Error in atomic checkAndDeductAICredits:", error);
      return {
        success: false,
        creditsRemaining: 0,
        creditsDeducted: 0,
        error: error.message,
      };
    }
  });
}

/**
 * Deduct credits for AI request (0.05 Core per request)
 * DEPRECATED: Use checkAndDeductAICredits() for atomic operations
 * Kept for backward compatibility but now uses locking
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditsRemaining: number, isCoreMember: boolean}>}
 */
export async function deductAICredits(userId) {
  const result = await checkAndDeductAICredits(userId);
  return {
    success: result.success,
    creditsRemaining: result.creditsRemaining,
    error: result.error,
    isCoreMember: false, // Legacy field
  };
}

/**
 * Get AI credit information for display
 * @param {string} userId - User ID
 * @returns {Promise<{credits: number, requestsRemaining: number}>}
 */
export async function getAICreditInfo(userId) {
  try {
    // Ensure config is loaded
    await getConfig();

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
    };

    const credits = userData.credits || 0;
    // Calculate how many requests user can make with current credits
    const creditsPerRequest = getCreditsPerRequestValue();
    const requestsRemaining = Math.floor(credits / creditsPerRequest);

    return {
      credits,
      requestsRemaining,
    };
  } catch (error) {
    logger.error("Error getting AI credit info:", error);
    return {
      credits: 0,
      requestsRemaining: 0,
    };
  }
}

/**
 * Check if user has enough credits for AI image generation
 * All users must pay Core credits for AI images (no unlimited access)
 * @param {string} userId - User ID
 * @returns {Promise<{hasCredits: boolean, credits: number, creditsNeeded: number, userData: Object}>}
 */
export async function checkAIImageCredits(userId) {
  try {
    // Validate input
    if (!validateUserId(userId)) {
      logger.warn(`Invalid userId format in checkAIImageCredits: ${userId}`);
      return {
        hasCredits: false,
        credits: 0,
        creditsNeeded: getCreditsPerImageValue(),
        userData: {
          credits: 0,
          subscriptionCredits: 0,
          bonusCredits: 0,
          totalGenerated: 0,
        },
      };
    }

    // Ensure config is loaded
    await getConfig();

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
      subscriptionCredits: 0,
      bonusCredits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Check if user has enough credits
    // All users must pay, including Core members
    const creditsPerImage = getCreditsPerImageValue();
    const hasEnoughCredits = userData.credits >= creditsPerImage;

    return {
      hasCredits: hasEnoughCredits,
      credits: userData.credits || 0,
      creditsNeeded: creditsPerImage,
      userData,
    };
  } catch (error) {
    logger.error("Error checking AI image credits:", error);
    return {
      hasCredits: false,
      credits: 0,
      creditsNeeded: getCreditsPerImageValue(),
      userData: {
        credits: 0,
        subscriptionCredits: 0,
        bonusCredits: 0,
        totalGenerated: 0,
      },
    };
  }
}

/**
 * Atomic check and deduct credits for AI image generation
 * Uses FIFO order: Subscription credits first, then bonus credits
 * Prevents race conditions by combining check and deduct in single locked operation
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditsRemaining: number, creditsDeducted: number, deductionBreakdown: Object, error?: string}>}
 */
export async function checkAndDeductAIImageCredits(userId) {
  // Validate input
  if (!validateUserId(userId)) {
    logger.warn(
      `Invalid userId format in checkAndDeductAIImageCredits: ${userId}`,
    );
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      deductionBreakdown: {
        totalDeducted: 0,
        subscriptionDeducted: 0,
        bonusDeducted: 0,
      },
      error: "Invalid user ID",
    };
  }

  return withCreditLock(userId, async () => {
    try {
      // Ensure config is loaded
      await getConfig();

      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};

      const userData = coreCredits[userId] || {
        credits: 0,
        subscriptionCredits: 0,
        bonusCredits: 0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
      };

      const creditsPerImage = getCreditsPerImageValue();

      // Check if user has enough credits (atomic check)
      if (userData.credits < creditsPerImage) {
        return {
          success: false,
          creditsRemaining: userData.credits || 0,
          creditsDeducted: 0,
          error: "Insufficient credits",
          deductionBreakdown: {
            totalDeducted: 0,
            subscriptionDeducted: 0,
            bonusDeducted: 0,
          },
        };
      }

      const previousCount = userData.totalGenerated || 0;

      // ===== CORE DEDUCTION LOGIC =====
      // FIFO Order: Subscription Cores first, then bonus Cores
      let remainingToDeduct = creditsPerImage;
      let subscriptionDeducted = 0;
      let bonusDeducted = 0;

      // Step 1: Deduct from subscription Cores first
      if (userData.subscriptionCredits && userData.subscriptionCredits > 0) {
        subscriptionDeducted = Math.min(
          remainingToDeduct,
          userData.subscriptionCredits,
        );
        userData.subscriptionCredits -= subscriptionDeducted;
        remainingToDeduct -= subscriptionDeducted;
      }

      // Step 2: Deduct from bonus Cores if still needed
      if (
        remainingToDeduct > 0 &&
        userData.bonusCredits &&
        userData.bonusCredits > 0
      ) {
        bonusDeducted = Math.min(remainingToDeduct, userData.bonusCredits);
        userData.bonusCredits -= bonusDeducted;
        remainingToDeduct -= bonusDeducted;
      }

      // Step 3: Update total Cores (atomic operation)
      userData.credits -= creditsPerImage;
      userData.totalGenerated = (userData.totalGenerated || 0) + 1;
      userData.lastUpdated = new Date().toISOString();

      // Round to 2 decimal places to avoid floating point precision issues
      userData.credits = Math.round(userData.credits * 100) / 100;

      coreCredits[userId] = userData;
      await storage.set("core_credit", coreCredits);

      const deductionBreakdown = {
        totalDeducted: creditsPerImage,
        subscriptionDeducted,
        bonusDeducted,
        remainingToDeduct,
      };

      logger.info(
        `User ${userId} used ${creditsPerImage} Core for image generation. ` +
          `Deduction: ${subscriptionDeducted} from subscription, ${bonusDeducted} from bonus. ` +
          `Remaining: ${userData.credits} total (${userData.subscriptionCredits} subscription, ${userData.bonusCredits} bonus). ` +
          `Total generated: ${previousCount} → ${userData.totalGenerated}`,
      );

      return {
        success: true,
        creditsRemaining: userData.credits,
        creditsDeducted: creditsPerImage,
        deductionBreakdown,
      };
    } catch (error) {
      logger.error("Error in atomic checkAndDeductAIImageCredits:", error);
      return {
        success: false,
        creditsRemaining: 0,
        creditsDeducted: 0,
        error: error.message,
        deductionBreakdown: {
          totalDeducted: 0,
          subscriptionDeducted: 0,
          bonusDeducted: 0,
        },
      };
    }
  });
}

/**
 * Deduct credits for AI image generation
 * DEPRECATED: Use checkAndDeductAIImageCredits() for atomic operations
 * Kept for backward compatibility but now uses locking
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditsRemaining: number, deductionBreakdown: Object}>}
 */
export async function deductAIImageCredits(userId) {
  const result = await checkAndDeductAIImageCredits(userId);
  return {
    success: result.success,
    creditsRemaining: result.creditsRemaining,
    deductionBreakdown: result.deductionBreakdown,
    error: result.error,
  };
}

/**
 * Refund credits to user (for failed generations or errors)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund (for audit trail)
 * @returns {Promise<{success: boolean, creditsRemaining: number, error?: string}>}
 */
export async function refundAICredits(userId, amount, reason = "Unknown") {
  // Validate input
  if (!validateUserId(userId)) {
    logger.warn(`Invalid userId format in refundAICredits: ${userId}`);
    return {
      success: false,
      creditsRemaining: 0,
      error: "Invalid user ID",
    };
  }

  if (typeof amount !== "number" || amount <= 0) {
    logger.warn(`Invalid refund amount: ${amount}`);
    return {
      success: false,
      creditsRemaining: 0,
      error: "Invalid refund amount",
    };
  }

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};

      const creditData = coreCredits[userId] || {
        credits: 0,
      };

      // Refund credits
      creditData.credits = (creditData.credits || 0) + amount;
      creditData.lastUpdated = new Date().toISOString();

      // Round to 2 decimal places
      creditData.credits = Math.round(creditData.credits * 100) / 100;

      coreCredits[userId] = creditData;
      await storage.set("core_credit", coreCredits);

      logger.info(
        `User ${userId} refunded ${amount} Core. Reason: ${reason}. New balance: ${creditData.credits}`,
      );

      return {
        success: true,
        creditsRemaining: creditData.credits,
      };
    } catch (error) {
      logger.error("Error refunding AI credits:", error);
      return {
        success: false,
        creditsRemaining: 0,
        error: error.message,
      };
    }
  });
}

/**
 * Refund credits for AI image generation (for failed generations)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund (for audit trail)
 * @returns {Promise<{success: boolean, creditsRemaining: number, error?: string}>}
 */
export async function refundAIImageCredits(userId, amount, reason = "Unknown") {
  // Validate input
  if (!validateUserId(userId)) {
    logger.warn(`Invalid userId format in refundAIImageCredits: ${userId}`);
    return {
      success: false,
      creditsRemaining: 0,
      error: "Invalid user ID",
    };
  }

  if (typeof amount !== "number" || amount <= 0) {
    logger.warn(`Invalid refund amount: ${amount}`);
    return {
      success: false,
      creditsRemaining: 0,
      error: "Invalid refund amount",
    };
  }

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};

      const userData = coreCredits[userId] || {
        credits: 0,
        subscriptionCredits: 0,
        bonusCredits: 0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
      };

      // Refund to total credits (simplified - could be enhanced to track refund source)
      userData.credits = (userData.credits || 0) + amount;
      userData.lastUpdated = new Date().toISOString();

      // Round to 2 decimal places
      userData.credits = Math.round(userData.credits * 100) / 100;

      coreCredits[userId] = userData;
      await storage.set("core_credit", coreCredits);

      logger.info(
        `User ${userId} refunded ${amount} Core for image generation. Reason: ${reason}. New balance: ${userData.credits}`,
      );

      return {
        success: true,
        creditsRemaining: userData.credits,
      };
    } catch (error) {
      logger.error("Error refunding AI image credits:", error);
      return {
        success: false,
        creditsRemaining: 0,
        error: error.message,
      };
    }
  });
}
