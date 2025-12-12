import express from "express";
import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();
const router = express.Router();

/**
 * Get supporter leaderboard
 * GET /api/supporters/leaderboard
 * Returns ranked list of all users who have purchased Core Energy
 */
router.get("/leaderboard", async (req, res) => {
  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Aggregate supporter data
    const supporters = [];
    let totalRaised = 0;

    for (const [userId, userData] of Object.entries(coreCredits)) {
      const payments = userData.cryptoPayments || [];

      if (payments.length === 0) continue;

      // Calculate totals
      const totalDonated = payments.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );
      const totalCores = payments.reduce((sum, p) => sum + (p.cores || 0), 0);
      const paymentCount = payments.length;

      if (totalDonated > 0) {
        supporters.push({
          userId,
          username: userData.username || null,
          totalDonated,
          totalCores,
          paymentCount,
        });
        totalRaised += totalDonated;
      }
    }

    // Sort by total donated (descending)
    supporters.sort((a, b) => b.totalDonated - a.totalDonated);

    // Add rank
    supporters.forEach((supporter, index) => {
      supporter.rank = index + 1;
    });

    logger.info(
      `📊 Supporter leaderboard: ${supporters.length} supporters, $${totalRaised.toFixed(2)} total raised`,
    );

    res.json(
      createSuccessResponse({
        supporters,
        totalSupporters: supporters.length,
        totalRaised,
      }),
    );
  } catch (error) {
    logger.error("Error getting supporter leaderboard:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to get supporter leaderboard", 500)
          .response,
      );
  }
});

export default router;
