import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";
import { getAIFeatureCosts } from "../../config/ai.js";

const logger = getLogger();

const DEFAULT_CREDITS_PER_CHAT = 0.05;
const DEFAULT_CREDITS_PER_IMAGE = 1.2;

/**
 * Format Core credits to always show exactly 2 decimal places
 */
export function formatCoreCredits(credits) {
  if (typeof credits !== "number" || isNaN(credits)) return 0.0;
  return Math.round(credits * 100) / 100;
}

// In-memory locks to prevent overlapping operations for the same user
const creditLocks = new Map();

/**
 * Sequential execution lock - atomic chain version
 * Ensures multiple bot instances (if any) or rapid successive calls
 * process in strict order.
 */
async function withCreditLock(userId, operation) {
  if (!userId) throw new Error("Invalid userId");

  const previousLock = creditLocks.get(userId) || Promise.resolve();
  let resolveNext;
  const nextLock = new Promise(resolve => {
    resolveNext = resolve;
  });
  creditLocks.set(userId, nextLock);

  try {
    await previousLock;
  } catch (_e) {
    // Ignore errors from previous operations in the chain
  }

  try {
    return await operation();
  } finally {
    resolveNext();
    if (creditLocks.get(userId) === nextLock) {
      creditLocks.delete(userId);
    }
  }
}

/**
 * Internal helper to get fresh config values
 */
async function getConfig() {
  try {
    const featureCosts = getAIFeatureCosts();
    return {
      aiChat: featureCosts.aiChat || DEFAULT_CREDITS_PER_CHAT,
      aiImage: featureCosts.aiImage || DEFAULT_CREDITS_PER_IMAGE,
      featureCosts,
    };
  } catch (_e) {
    return {
      aiChat: DEFAULT_CREDITS_PER_CHAT,
      aiImage: DEFAULT_CREDITS_PER_IMAGE,
      featureCosts: null,
    };
  }
}

/**
 * Validate userId format (Discord Snowflake)
 */
function validateUserId(userId) {
  return typeof userId === "string" && /^\d{17,19}$/.test(userId.trim());
}

/**
 * Get the cost for a specific provider and model
 */
export async function getProviderModelCost(provider, model) {
  try {
    const config = await getConfig();
    const costs = config.featureCosts;
    if (costs?.providerCosts?.[provider]) {
      const pCosts = costs.providerCosts[provider];
      if (model && pCosts[model]) return pCosts[model];
      if (pCosts.default) return pCosts.default;
    }
    return config.aiImage;
  } catch (_e) {
    return DEFAULT_CREDITS_PER_IMAGE;
  }
}

/**
 * Check if user has enough credits (for UI/Pre-checks)
 */
export async function checkAICredits(userId) {
  try {
    if (!validateUserId(userId))
      return {
        hasCredits: false,
        credits: 0,
        creditsNeeded: DEFAULT_CREDITS_PER_CHAT,
      };
    const storage = await getStorageManager();
    const data = await storage.getCoreCredits(userId);
    const credits = data ? data.credits : 0;
    const config = await getConfig();
    const needed = config.aiChat;

    return {
      hasCredits: credits >= needed, // Removed legacy needed*2 buffer for UI consistency
      credits: formatCoreCredits(credits),
      creditsNeeded: formatCoreCredits(needed),
    };
  } catch (_error) {
    return {
      hasCredits: false,
      credits: 0,
      creditsNeeded: DEFAULT_CREDITS_PER_CHAT,
    };
  }
}

/**
 * Atomic Add Credits (Safe for Webhooks/Top-ups)
 */
export async function addCoreCredits(userId, amount, source = "payment") {
  if (!validateUserId(userId))
    return { success: false, error: "Invalid user ID" };
  if (typeof amount !== "number" || amount <= 0)
    return { success: false, error: "Invalid amount" };

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      let data = await storage.getCoreCredits(userId);

      if (!data) {
        data = {
          credits: 0,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
          username: null,
        };
      }

      data.credits = formatCoreCredits((data.credits || 0) + amount);
      data.totalGenerated = (data.totalGenerated || 0) + amount; // Sync with historical total
      data.lastUpdated = new Date().toISOString();

      await storage.setCoreCredits(userId, data);
      logger.info(
        `Credits added for ${userId}: +${amount} (${source}). New balance: ${data.credits}`,
      );

      return { success: true, newBalance: data.credits };
    } catch (error) {
      logger.error(`Failed to add credits to ${userId}:`, error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Atomic check and deduct credits for AI chat
 */
export async function checkAndDeductAICredits(userId) {
  if (!validateUserId(userId))
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      error: "Invalid user ID",
    };

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      let data = await storage.getCoreCredits(userId);

      if (!data) {
        data = {
          credits: 0,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      const config = await getConfig();
      const needed = config.aiChat;

      if ((data.credits || 0) < needed) {
        return {
          success: false,
          creditsRemaining: formatCoreCredits(data.credits),
          creditsDeducted: 0,
          error: "Insufficient credits",
        };
      }

      data.credits = formatCoreCredits(data.credits - needed);
      data.totalGenerated = (data.totalGenerated || 0) + 1; // Increment for chat too
      data.lastUpdated = new Date().toISOString();

      await storage.setCoreCredits(userId, data);

      return {
        success: true,
        creditsRemaining: data.credits,
        creditsDeducted: formatCoreCredits(needed),
      };
    } catch (error) {
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
 * Check AI image credits
 */
export async function checkAIImageCredits(
  userId,
  provider = null,
  model = null,
) {
  try {
    if (!validateUserId(userId))
      return {
        hasCredits: false,
        credits: 0,
        creditsNeeded: DEFAULT_CREDITS_PER_IMAGE,
      };
    const storage = await getStorageManager();
    const data = await storage.getCoreCredits(userId);
    const credits = data ? data.credits : 0;
    const needed = await getProviderModelCost(provider, model);

    return {
      hasCredits: credits >= needed,
      credits: formatCoreCredits(credits),
      creditsNeeded: formatCoreCredits(needed),
      userData: data || { credits: 0 },
    };
  } catch (_e) {
    return {
      hasCredits: false,
      credits: 0,
      creditsNeeded: DEFAULT_CREDITS_PER_IMAGE,
    };
  }
}

/**
 * Atomic check and deduct credits for AI image generation
 */
export async function checkAndDeductAIImageCredits(
  userId,
  provider = null,
  model = null,
) {
  if (!validateUserId(userId))
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      error: "Invalid user ID",
    };

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      let data = await storage.getCoreCredits(userId);

      if (!data) {
        data = {
          credits: 0,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      const needed = await getProviderModelCost(provider, model);

      if ((data.credits || 0) < needed) {
        return {
          success: false,
          creditsRemaining: formatCoreCredits(data.credits),
          creditsDeducted: 0,
          error: "Insufficient credits",
        };
      }

      data.credits = formatCoreCredits(data.credits - needed);
      data.totalGenerated = (data.totalGenerated || 0) + 1;
      data.lastUpdated = new Date().toISOString();
      await storage.setCoreCredits(userId, data);

      return {
        success: true,
        creditsRemaining: data.credits,
        creditsDeducted: formatCoreCredits(needed),
        deductionBreakdown: { totalDeducted: formatCoreCredits(needed) },
      };
    } catch (error) {
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
 * Deduct credits based on actual API usage (Token-based)
 */
export async function deductCreditsFromUsage(
  userId,
  usage,
  provider,
  model,
  conversionRate = 1.0,
) {
  if (!validateUserId(userId))
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      error: "Invalid user ID",
    };
  if (!usage || typeof usage.cost !== "number")
    return {
      success: false,
      creditsRemaining: 0,
      creditsDeducted: 0,
      error: "Invalid usage data",
    };

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      let data = await storage.getCoreCredits(userId);

      if (!data) {
        data = {
          credits: 0,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      const featureCosts = getAIFeatureCosts();
      const min = featureCosts.tokenPricing?.[provider]?.minimumCharge || 0.05;
      const needed = formatCoreCredits(
        Math.max(usage.cost * conversionRate, min),
      );

      if ((data.credits || 0) < needed) {
        return {
          success: false,
          creditsRemaining: formatCoreCredits(data.credits),
          creditsDeducted: 0,
          error: "Insufficient credits",
          deductionBreakdown: {
            totalDeducted: 0,
            actualApiCost: usage.cost,
            conversionRate,
          },
        };
      }

      data.credits = formatCoreCredits(data.credits - needed);
      data.totalGenerated = (data.totalGenerated || 0) + 1;
      data.lastUpdated = new Date().toISOString();
      await storage.setCoreCredits(userId, data);

      return {
        success: true,
        creditsRemaining: data.credits,
        creditsDeducted: needed,
        deductionBreakdown: {
          totalDeducted: needed,
          actualApiCost: usage.cost,
          conversionRate,
        },
      };
    } catch (error) {
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
 * Atomic Refund
 */
export async function refundAICredits(userId, amount, reason = "Unknown") {
  if (!validateUserId(userId))
    return { success: false, creditsRemaining: 0, error: "Invalid user ID" };
  if (typeof amount !== "number" || amount <= 0)
    return {
      success: false,
      creditsRemaining: 0,
      error: "Invalid refund amount",
    };

  return withCreditLock(userId, async () => {
    try {
      const storage = await getStorageManager();
      let data = await storage.getCoreCredits(userId);

      if (!data)
        data = {
          credits: 0,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
        };

      data.credits = formatCoreCredits(data.credits + amount);
      data.lastUpdated = new Date().toISOString();
      await storage.setCoreCredits(userId, data);

      logger.info(
        `Credits refunded to ${userId}: +${amount} (Reason: ${reason})`,
      );
      return { success: true, creditsRemaining: data.credits };
    } catch (error) {
      return { success: false, creditsRemaining: 0, error: error.message };
    }
  });
}

export async function refundAIImageCredits(userId, amount, reason = "Unknown") {
  return await refundAICredits(userId, amount, reason);
}

// Legacy Aliases
export async function deductAICredits(userId) {
  return await checkAndDeductAICredits(userId);
}
export async function deductAIImageCredits(userId) {
  return await checkAndDeductAIImageCredits(userId);
}

/**
 * Get AI credit information for display
 */
export async function getAICreditInfo(userId) {
  try {
    const config = await getConfig();
    const storage = await getStorageManager();
    const userData = (await storage.getCoreCredits(userId)) || { credits: 0 };
    return {
      credits: formatCoreCredits(userData.credits),
      requestsRemaining: Math.floor(userData.credits / config.aiChat),
    };
  } catch (_error) {
    return { credits: 0, requestsRemaining: 0 };
  }
}
