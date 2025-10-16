import { getStorageManager } from "../../../../utils/storage/storageManager.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

/**
 * Credit management utilities for avatar generation
 */
export class CreditManager {
  /**
   * Check user's credit balance and determine credits needed
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Credit information
   */
  static async checkUserCredits(userId) {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // All users pay 1 Core per avatar generation
    // Core members get rate limiting benefits instead of cost reduction
    const creditsNeeded = 1;

    return {
      userData,
      creditsNeeded,
      hasEnoughCredits: userData.credits >= creditsNeeded,
    };
  }

  /**
   * Deduct credits after successful avatar generation
   * Uses FIFO order: Subscription credits first, then bonus credits
   * @param {string} userId - User ID
   * @param {number} creditsNeeded - Credits to deduct
   * @returns {Promise<Object>} Updated user data with deduction breakdown
   */
  static async deductCredits(userId, creditsNeeded) {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    const previousCount = userData.totalGenerated;

    // ===== CREDIT DEDUCTION LOGIC =====
    // FIFO Order: Subscription credits first, then bonus credits
    let remainingToDeduct = creditsNeeded;
    let subscriptionDeducted = 0;
    let bonusDeducted = 0;

    // Step 1: Deduct from subscription credits first
    if (userData.subscriptionCredits && userData.subscriptionCredits > 0) {
      subscriptionDeducted = Math.min(
        remainingToDeduct,
        userData.subscriptionCredits,
      );
      userData.subscriptionCredits -= subscriptionDeducted;
      remainingToDeduct -= subscriptionDeducted;
    }

    // Step 2: Deduct from bonus credits if still needed
    if (
      remainingToDeduct > 0 &&
      userData.bonusCredits &&
      userData.bonusCredits > 0
    ) {
      bonusDeducted = Math.min(remainingToDeduct, userData.bonusCredits);
      userData.bonusCredits -= bonusDeducted;
      remainingToDeduct -= bonusDeducted;
    }

    // Step 3: Update total credits
    userData.credits -= creditsNeeded;
    userData.totalGenerated += 1;
    userData.lastUpdated = new Date().toISOString();

    coreCredits[userId] = userData;
    await storage.set("core_credit", coreCredits);

    // Log detailed deduction breakdown
    logger.info(
      `User ${userId} used ${creditsNeeded} Core for avatar generation. ` +
        `Deduction: ${subscriptionDeducted} from subscription, ${bonusDeducted} from bonus. ` +
        `Remaining: ${userData.credits} total (${userData.subscriptionCredits} subscription, ${userData.bonusCredits} bonus). ` +
        `Total generated: ${previousCount} → ${userData.totalGenerated}`,
    );

    return {
      ...userData,
      deductionBreakdown: {
        totalDeducted: creditsNeeded,
        subscriptionDeducted,
        bonusDeducted,
        remainingToDeduct,
      },
    };
  }
}
