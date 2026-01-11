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
// Defaults loaded from config - these are only used as absolute fallback if config loading fails
const DEFAULT_CREDITS_PER_CHAT = 0.08; // Fallback only - actual value comes from config/ai.js
const DEFAULT_CREDITS_PER_IMAGE = 1.2; // Fallback only - actual value comes from config/ai.js

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
  // Always load fresh feature costs to ensure provider-specific costs are available
  let featureCosts = null;
  
  try {
    // Try new AI config first
    const aiConfigModule = await import("../../config/ai.js").catch(() => null);
    if (aiConfigModule) {
      const getFeatureCosts =
        aiConfigModule.getAIFeatureCosts ||
        aiConfigModule.default?.getAIFeatureCosts;
      if (getFeatureCosts) {
        featureCosts =
          typeof getFeatureCosts === "function"
            ? getFeatureCosts()
            : getFeatureCosts;
      }
    }
  } catch (error) {
    logger.debug("Failed to load fresh feature costs:", error);
  }

  if (chatConfigCache !== null && imageConfigCache !== null) {
    return { 
      aiChat: chatConfigCache, 
      aiImage: imageConfigCache,
      featureCosts // Return fresh feature costs
    };
  }

  try {
    // Try new AI config first (if not already loaded above)
    if (!featureCosts) {
      const aiConfigModule = await import("../../config/ai.js").catch(() => null);
      if (aiConfigModule) {
        const getFeatureCosts =
          aiConfigModule.getAIFeatureCosts ||
          aiConfigModule.default?.getAIFeatureCosts;
        if (getFeatureCosts) {
          featureCosts =
            typeof getFeatureCosts === "function"
              ? getFeatureCosts()
              : getFeatureCosts;
        }
      }
    }

    if (featureCosts) {
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

      return { 
        aiChat: chatConfigCache, 
        aiImage: imageConfigCache,
        featureCosts 
      };
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

      return { 
        aiChat: chatConfigCache, 
        aiImage: imageConfigCache,
        featureCosts: config?.corePricing?.featureCosts
      };
    }
  } catch (error) {
    logger.debug("Failed to load config, using defaults:", error);
  }

  chatConfigCache = DEFAULT_CREDITS_PER_CHAT;
  imageConfigCache = DEFAULT_CREDITS_PER_IMAGE;
  return { 
    aiChat: chatConfigCache, 
    aiImage: imageConfigCache,
    featureCosts: null
  };
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
    // Check for 2x credits to cover initial API call + potential re-query
    const creditsPerRequest = getCreditsPerRequestValue();
    const creditsNeededForReQuery = creditsPerRequest * 2; // Initial + potential re-query
    const hasEnoughCredits = creditData.credits >= creditsNeededForReQuery;

    return {
      hasCredits: hasEnoughCredits,
      credits: creditData.credits || 0,
      creditsNeeded: creditsPerRequest, // Return single request credits for display
      isCoreMember: false,
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
 * Deduct credits for AI request
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
    isCoreMember: false,
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
 * Get the cost for a specific provider and model
 * @param {string} provider - Provider name (stability, comfyui, etc.)
 * @param {string} model - Model name
 * @returns {Promise<number>} Cost in Core credits
 */
async function getProviderModelCost(provider, model) {
  try {
    const config = await getConfig();
    const featureCosts = config.featureCosts || {};
    
    // Check for provider-specific credits first
    if (featureCosts.providerCosts && featureCosts.providerCosts[provider]) {
      const providerCosts = featureCosts.providerCosts[provider];
      
      // Check for model-specific credits
      if (providerCosts[model]) {
        return providerCosts[model];
      }
      
      // Check for default provider credits
      if (providerCosts.default) {
        return providerCosts.default;
      }
    }
    
    // Fallback to generic image credits
    return featureCosts.aiImage || DEFAULT_CREDITS_PER_IMAGE;
  } catch (error) {
    logger.debug("Error getting provider model cost, using default:", error);
    return DEFAULT_CREDITS_PER_IMAGE;
  }
}

/**
 * Check if user has enough credits for AI image generation with provider/model specific costs
 * @param {string} userId - User ID
 * @param {string} provider - Provider name (optional)
 * @param {string} model - Model name (optional)
 * @returns {Promise<{hasCredits: boolean, credits: number, creditsNeeded: number, userData: Object}>}
 */
export async function checkAIImageCredits(userId, provider = null, model = null) {
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

    // Get provider and model-specific credits
    let creditsPerImage = getCreditsPerImageValue(); // Default fallback
    if (provider && model) {
      creditsPerImage = await getProviderModelCost(provider, model);
    }

    // Check if user has enough credits
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
 * Atomic check and deduct credits for AI image generation with provider/model specific costs
 * @param {string} userId - User ID
 * @param {string} provider - Provider name (optional)
 * @param {string} model - Model name (optional)
 * @returns {Promise<{success: boolean, creditsRemaining: number, creditsDeducted: number, deductionBreakdown: Object, error?: string}>}
 */
export async function checkAndDeductAIImageCredits(userId, provider = null, model = null) {
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

      // Get provider and model-specific credits
      let creditsPerImage = getCreditsPerImageValue(); // Default fallback
      if (provider && model) {
        creditsPerImage = await getProviderModelCost(provider, model);
      }

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
      // FIFO Order: Existing subscription Cores (if any) first, then bonus Cores
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
        `User ${userId} used ${creditsPerImage} Core for ${provider}/${model} image generation. ` +
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
 * Deduct credits based on actual API usage (for providers that return usage info)
 * @param {string} userId - User ID
 * @param {Object} usage - Usage information from API response
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number} conversionRate - Rate to convert API credits to Core credits (default: 1:1)
 * @returns {Promise<{success: boolean, creditsRemaining: number, creditsDeducted: number, deductionBreakdown: Object, error?: string}>}
 */
export async function deductCreditsFromUsage(userId, usage, provider, model, conversionRate = 1.0) {
  // Validate input
  if (!validateUserId(userId)) {
    logger.warn(`Invalid userId format in deductCreditsFromUsage: ${userId}`);
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      deductionBreakdown: {
        totalDeducted: 0,
        subscriptionDeducted: 0,
        bonusDeducted: 0,
        actualApiCost: 0,
        conversionRate,
      },
      error: "Invalid user ID",
    };
  }

  if (!usage || typeof usage.cost !== 'number') {
    logger.warn(`Invalid usage data for user ${userId}: ${JSON.stringify(usage)}`);
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      deductionBreakdown: {
        totalDeducted: 0,
        subscriptionDeducted: 0,
        bonusDeducted: 0,
        actualApiCost: 0,
        conversionRate,
      },
      error: "Invalid usage data",
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

      // Calculate Core credits to deduct based on actual API usage
      const actualApiCost = usage.cost; // OpenRouter credits
      const creditsToDeduct = actualApiCost * conversionRate; // Convert to Core credits, preserve decimals

      // Minimum deduction of 0.01 Core credits (configurable per provider)
      let minimumCharge = 0.01;
      try {
        const { getAIFeatureCosts } = await import("../../config/ai.js");
        const featureCosts = getAIFeatureCosts();
        if (featureCosts.tokenPricing && featureCosts.tokenPricing[provider]) {
          minimumCharge = featureCosts.tokenPricing[provider].minimumCharge || 0.01;
        }
      } catch (_error) {
        // Use default minimum if config loading fails
      }
      
      const finalCreditsToDeduct = Math.max(creditsToDeduct, minimumCharge);

      // Check if user has enough credits
      if (userData.credits < finalCreditsToDeduct) {
        return {
          success: false,
          creditsRemaining: userData.credits || 0,
          creditsDeducted: 0,
          error: "Insufficient credits",
          deductionBreakdown: {
            totalDeducted: 0,
            subscriptionDeducted: 0,
            bonusDeducted: 0,
            actualApiCost,
            conversionRate,
          },
        };
      }

      const previousCount = userData.totalGenerated || 0;

      // ===== CORE DEDUCTION LOGIC =====
      // FIFO Order: Existing subscription Cores (if any) first, then bonus Cores
      let remainingToDeduct = finalCreditsToDeduct;
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
      userData.credits -= finalCreditsToDeduct;
      userData.totalGenerated = (userData.totalGenerated || 0) + 1;
      userData.lastUpdated = new Date().toISOString();

      // Round to 2 decimal places to avoid floating point precision issues
      userData.credits = Math.round(userData.credits * 100) / 100;

      coreCredits[userId] = userData;
      await storage.set("core_credit", coreCredits);

      const deductionBreakdown = {
        totalDeducted: finalCreditsToDeduct,
        subscriptionDeducted,
        bonusDeducted,
        remainingToDeduct,
        actualApiCost,
        conversionRate,
      };

      logger.info(
        `💰 Usage-based deduction for user ${userId}: ${provider}/${model} ` +
          `API cost: ${actualApiCost} credits → ${finalCreditsToDeduct} Core credits (${conversionRate}x rate). ` +
          `Deduction: ${subscriptionDeducted} from subscription, ${bonusDeducted} from bonus. ` +
          `Remaining: ${userData.credits} total (${userData.subscriptionCredits} subscription, ${userData.bonusCredits} bonus). ` +
          `Total generated: ${previousCount} → ${userData.totalGenerated}`,
      );

      return {
        success: true,
        creditsRemaining: userData.credits,
        creditsDeducted: finalCreditsToDeduct,
        deductionBreakdown,
      };
    } catch (error) {
      logger.error("Error in usage-based credit deduction:", error);
      return {
        success: false,
        creditsRemaining: 0,
        creditsDeducted: 0,
        error: error.message,
        deductionBreakdown: {
          totalDeducted: 0,
          subscriptionDeducted: 0,
          bonusDeducted: 0,
          actualApiCost: usage?.cost || 0,
          conversionRate,
        },
      };
    }
  });
}
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
