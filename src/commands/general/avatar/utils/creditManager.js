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
   * @param {string} userId - User ID
   * @param {number} creditsNeeded - Credits to deduct
   * @returns {Promise<Object>} Updated user data
   */
  static async deductCredits(userId, creditsNeeded) {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    const previousCount = userData.totalGenerated;

    // All users pay 1 Core per avatar generation
    userData.credits -= creditsNeeded;
    userData.totalGenerated += 1;
    userData.lastUpdated = new Date().toISOString();

    coreCredits[userId] = userData;
    await storage.set("core_credit", coreCredits);

    logger.info(
      `User ${userId} used ${creditsNeeded} Core for avatar generation. Remaining: ${userData.credits}. Total generated: ${previousCount} → ${userData.totalGenerated}`,
    );

    return userData;
  }
}
