import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";

const logger = getLogger();

/**
 * Reset premium state for a guild (for testing)
 */
export async function apiResetPremium(req, res) {
  const { guildId } = req.params;
  logRequest(`Reset premium state for guild ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const db = await premiumManager._db();
    if (!db) throw new Error("Database not available");

    await db.guildSettings.collection.updateOne(
      { guildId },
      { $unset: { premiumFeatures: "" } },
    );
    db.guildSettings._invalidate(guildId);

    logger.info(`🔄 Premium state reset for guild ${guildId}`);
    res.json(
      createSuccessResponse({
        guildId,
        message: "Premium state reset successfully",
      }),
    );
  } catch (error) {
    logger.error(`❌ Error resetting premium for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to reset premium state",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Activate a premium feature
 */
export async function apiActivatePremiumFeature(req, res) {
  const { guildId } = req.params;
  let { featureId, userId } = req.body;

  if (!featureId) featureId = "pro_engine";

  if (!userId) {
    userId =
      req.user?.id ||
      req.session?.discordUser?.id ||
      req.headers["x-user-id"] ||
      req.headers["x-discord-id"];
  }

  logRequest(
    `Activate premium feature: ${featureId} for guild ${guildId}`,
    req,
  );

  if (!guildId || !featureId || !userId) {
    logger.warn(`Missing parameters for activate request:`, {
      guildId,
      featureId,
      userId,
    });
    const { statusCode, response } = createErrorResponse(
      "Guild ID, Feature ID, and User ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const result = await premiumManager.activateFeature(
      guildId,
      featureId,
      userId,
    );

    if (result.success) {
      res.json(createSuccessResponse(result));
    } else {
      const { statusCode, response } = createErrorResponse(result.message, 400);
      res.status(statusCode).json(response);
    }
  } catch (error) {
    logger.error(
      `❌ Error activating premium feature ${featureId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to activate premium feature",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Cancel a premium feature subscription
 */
export async function apiCancelPremiumFeature(req, res) {
  const { guildId } = req.params;
  let { featureId, userId } = req.body;

  if (!featureId) featureId = "pro_engine";

  if (!userId) {
    userId =
      req.user?.id ||
      req.session?.discordUser?.id ||
      req.headers["x-user-id"] ||
      req.headers["x-discord-id"];
  }

  logRequest(`Cancel premium feature: ${featureId} for guild ${guildId}`, req);

  if (!guildId || !featureId || !userId) {
    logger.warn(`Missing parameters for cancel request:`, {
      guildId,
      featureId,
      userId,
    });
    const { statusCode, response } = createErrorResponse(
      "Guild ID, Feature ID, and User ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const result = await premiumManager.cancelFeature(
      guildId,
      featureId,
      userId,
    );

    if (result.success) {
      res.json(createSuccessResponse(result));
    } else {
      const { statusCode, response } = createErrorResponse(result.message, 400);
      res.status(statusCode).json(response);
    }
  } catch (error) {
    logger.error(
      `❌ Error cancelling premium feature ${featureId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to cancel premium feature",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Activate a free trial of Pro Engine for a guild
 */
export async function apiActivateTrial(req, res) {
  const { guildId } = req.params;
  const userId =
    req.user?.id ||
    req.session?.discordUser?.id ||
    req.headers["x-user-id"] ||
    req.headers["x-discord-id"];

  logRequest(`Activate trial for guild ${guildId}`, req);

  if (!guildId || !userId) {
    logger.warn(`Missing parameters for trial activation:`, {
      guildId,
      userId,
    });
    const { statusCode, response } = createErrorResponse(
      "Guild ID and User ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const result = await premiumManager.activateTrial(guildId, userId);

    if (result.success) {
      res.json(createSuccessResponse(result));
    } else {
      const { statusCode, response } = createErrorResponse(result.message, 400);
      res.status(statusCode).json(response);
    }
  } catch (error) {
    logger.error(`❌ Error activating trial for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to activate trial",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get premium subscription status for a guild
 */
export async function apiGetPremiumStatus(req, res) {
  const { guildId } = req.params;
  const featureId = req.query.featureId || "pro_engine";
  logRequest(`Get premium status: ${featureId} for guild ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const status = await premiumManager.getSubscriptionStatus(
      guildId,
      featureId,
    );

    res.json(
      createSuccessResponse({ guildId, featureId, subscription: status }),
    );
  } catch (error) {
    logger.error(
      `❌ Error getting premium status for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to get premium status",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
