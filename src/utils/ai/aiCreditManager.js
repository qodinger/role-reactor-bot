import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";
import { getUserData } from "../../commands/general/core/utils.js";

const logger = getLogger();

/**
 * AI Credit Manager
 * Handles credit checks and deductions for AI features
 * Pricing: 0.1 Core per AI request (1 Core = 10 requests)
 */

// Credit cost per AI request
const CREDITS_PER_REQUEST = 0.1; // 0.1 Core per request

/**
 * Check if user has enough credits for AI request
 * Core members get unlimited requests (bypass credit check)
 * @param {string} userId - User ID
 * @returns {Promise<{hasCredits: boolean, credits: number, creditsNeeded: number, isCoreMember: boolean}>}
 */
export async function checkAICredits(userId) {
  try {
    // Check if user is Core member (unlimited requests)
    const userData = await getUserData(userId);
    if (userData.isCore && userData.coreTier) {
      return {
        hasCredits: true, // Core members have unlimited requests
        credits: userData.credits || 0,
        creditsNeeded: 0, // No credits needed for Core members
        isCoreMember: true,
      };
    }

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const creditData = coreCredits[userId] || {
      credits: 0,
    };

    // Check if user has enough credits (0.1 Core minimum)
    const hasEnoughCredits = creditData.credits >= CREDITS_PER_REQUEST;

    return {
      hasCredits: hasEnoughCredits,
      credits: creditData.credits || 0,
      creditsNeeded: CREDITS_PER_REQUEST,
      isCoreMember: false,
    };
  } catch (error) {
    logger.error("Error checking AI credits:", error);
    return {
      hasCredits: false,
      credits: 0,
      creditsNeeded: CREDITS_PER_REQUEST,
      isCoreMember: false,
    };
  }
}

/**
 * Deduct credits for AI request (0.1 Core per request)
 * Core members bypass credit deduction (unlimited requests)
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditsRemaining: number, isCoreMember: boolean}>}
 */
export async function deductAICredits(userId) {
  try {
    // Check if user is Core member (unlimited requests, no deduction)
    const userData = await getUserData(userId);
    if (userData.isCore && userData.coreTier) {
      logger.debug(
        `User ${userId} (Core ${userData.coreTier}) used AI: Unlimited request (no deduction)`,
      );
      return {
        success: true,
        creditsRemaining: userData.credits || 0,
        isCoreMember: true,
      };
    }

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const creditData = coreCredits[userId] || {
      credits: 0,
    };

    // Check if user has enough credits
    if (creditData.credits < CREDITS_PER_REQUEST) {
      return {
        success: false,
        creditsRemaining: creditData.credits || 0,
        error: "Insufficient credits",
        isCoreMember: false,
      };
    }

    // Deduct 0.1 Core per request
    creditData.credits = (creditData.credits || 0) - CREDITS_PER_REQUEST;
    creditData.lastUpdated = new Date().toISOString();

    // Round to 2 decimal places to avoid floating point precision issues
    creditData.credits = Math.round(creditData.credits * 100) / 100;

    coreCredits[userId] = creditData;
    await storage.set("core_credit", coreCredits);

    logger.debug(
      `User ${userId} used AI: Deducted ${CREDITS_PER_REQUEST} Core (${creditData.credits} remaining)`,
    );

    return {
      success: true,
      creditsRemaining: creditData.credits,
      isCoreMember: false,
    };
  } catch (error) {
    logger.error("Error deducting AI credits:", error);
    return {
      success: false,
      creditsRemaining: 0,
      error: error.message,
      isCoreMember: false,
    };
  }
}

/**
 * Get AI credit information for display
 * @param {string} userId - User ID
 * @returns {Promise<{credits: number, requestsRemaining: number}>}
 */
export async function getAICreditInfo(userId) {
  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
    };

    const credits = userData.credits || 0;
    // Calculate how many requests user can make with current credits
    const requestsRemaining = Math.floor(credits / CREDITS_PER_REQUEST);

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
