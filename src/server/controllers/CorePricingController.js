import { getLogger } from "../../utils/logger.js";
import { createSuccessResponse, createErrorResponse } from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Core pricing endpoint - Returns package pricing for website integration
 */
export async function apiPricing(req, res) {
  logRequest("Pricing info", req);

  try {
    const corePricing = config.corePricing;

    if (!corePricing || !corePricing.packages) {
      const { statusCode, response } = createErrorResponse("Pricing configuration not available", 500);
      return res.status(statusCode).json(response);
    }

    const userId = req.query.user_id || req.query.discord_id || null;
    const isDev = config.isDeveloper(userId);

    const packages = Object.entries(corePricing.packages)
      .filter(([_, pkg]) => !pkg.hidden || isDev)
      .map(([key, pkg]) => ({
        id: key,
        name: pkg.name,
        price: parseFloat(key.replace("$", "")),
        currency: "USD",
        baseCores: pkg.baseCores,
        bonusCores: pkg.bonusCores,
        totalCores: pkg.totalCores,
        rate: pkg.rate,
        valuePerDollar: `${pkg.rate.toFixed(1)} Cores/$1`,
        description: pkg.description,
        estimatedUsage: pkg.estimatedUsage,
        popular: pkg.popular || false,
        features: pkg.features || [],
      }));

    packages.sort((a, b) => a.price - b.price);

    const activePromotions = [];
    const promotions = corePricing.coreSystem?.promotions;

    if (promotions?.enabled && promotions?.types) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      for (const promo of promotions.types) {
        if (promo.type === "first_purchase") {
          activePromotions.push({
            name: promo.name,
            type: promo.type,
            bonus: `${promo.bonus * 100}%`,
            maxBonus: promo.maxBonus,
            description: `Get ${promo.bonus * 100}% bonus Cores on your first purchase (up to ${promo.maxBonus} bonus Cores)`,
          });
        } else if (promo.type === "weekend" && promo.days?.includes(dayOfWeek)) {
          activePromotions.push({
            name: promo.name,
            type: promo.type,
            bonus: `${promo.bonus * 100}%`,
            description: `Weekend special: ${promo.bonus * 100}% bonus Cores on all purchases!`,
            active: true,
          });
        }
      }
    }

    let userEligibility = null;
    if (userId) {
      try {
        const { getStorageManager } = await import("../../utils/storage/storageManager.js");
        const storage = await getStorageManager();
        const userData = await storage.getCoreCredits(userId);
        const hasPayments = userData?.paypalPayments?.length > 0 || userData?.cryptoPayments?.length > 0;
        userEligibility = { userId, isFirstPurchase: !hasPayments, currentCredits: userData?.credits || 0, eligibleForFirstPurchaseBonus: !hasPayments };
      } catch (error) {
        logger.warn("Failed to check user eligibility:", error.message);
      }
    }

    const minPayment = isDev && config.payments.paypal.testMode ? 1 : corePricing.coreSystem?.minimumPayment || 3;

    const response = {
      packages,
      minimumPayment: minPayment,
      currency: "USD",
      paymentMethods: {
        paypal: config.payments.paypal.enabled,
        crypto: config.payments.plisio.enabled,
      },
      promotions: activePromotions,
      referralSystem: corePricing.coreSystem?.referralSystem?.enabled ? {
        enabled: true,
        referrerBonus: `${(corePricing.coreSystem.referralSystem.referrerBonus || 0) * 100}%`,
        refereeBonus: `${(corePricing.coreSystem.referralSystem.refereeBonus || 0) * 100}%`,
        minimumPurchase: corePricing.coreSystem.referralSystem.minimumPurchase || 10,
      } : { enabled: false },
    };

    if (userEligibility) response.user = userEligibility;
    res.json(createSuccessResponse(response));
  } catch (error) {
    logger.error("❌ Error getting pricing info:", error);
    const { statusCode, response } = createErrorResponse("Failed to retrieve pricing information", 500, error.message);
    res.status(statusCode).json(response);
  }
}

/**
 * User Core balance endpoint
 */
export async function apiUserBalance(req, res) {
  logRequest("User balance", req);
  const userId = req.params.userId || req.query.user_id || req.query.discord_id;

  if (!userId) {
    const { statusCode, response } = createErrorResponse("User ID is required", 400, "Provide user_id as a URL parameter or query parameter");
    return res.status(statusCode).json(response);
  }

  try {
    const { getStorageManager } = await import("../../utils/storage/storageManager.js");
    const storage = await getStorageManager();
    const userData = await storage.getCoreCredits(userId);

    if (!userData) {
      return res.json(createSuccessResponse({ userId, credits: 0, hasAccount: false, paymentHistory: { paypal: 0, crypto: 0 } }));
    }

    res.json(createSuccessResponse({
      userId,
      credits: userData.credits || 0,
      hasAccount: true,
      lastUpdated: userData.lastUpdated || null,
      paymentHistory: {
        paypal: userData.paypalPayments?.length || 0,
        crypto: userData.cryptoPayments?.length || 0,
      },
    }));
  } catch (error) {
    logger.error("❌ Error getting user balance:", error);
    const { statusCode, response } = createErrorResponse("Failed to retrieve user balance", 500, error.message);
    res.status(statusCode).json(response);
  }
}

/**
 * User payment history endpoint
 */
export async function apiUserPayments(req, res) {
  logRequest("User payments", req);
  const userId = req.params.userId || req.query.user_id || req.query.discord_id;

  if (!userId) {
    const { statusCode, response } = createErrorResponse("User ID is required", 400, "Provide user_id as a URL parameter or query parameter");
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import("../../utils/storage/databaseManager.js");
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      const { getStorageManager } = await import("../../utils/storage/storageManager.js");
      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};
      const userData = coreCredits[userId];
      const payments = [];
      if (userData?.paypalPayments) payments.push(...userData.paypalPayments.map(p => ({ ...p, provider: "paypal" })));
      if (userData?.cryptoPayments) payments.push(...userData.cryptoPayments);
      payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return res.json(createSuccessResponse({ userId, payments, total: payments.length, source: "legacy" }));
    }

    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    const provider = req.query.provider || null;
    const payments = await dbManager.payments.findByDiscordId(userId, { limit, skip, status: "completed", provider });
    const stats = await dbManager.payments.getUserStats(userId);

    res.json(createSuccessResponse({
      userId,
      payments: payments.map(p => ({
        paymentId: p.paymentId,
        provider: p.provider,
        amount: p.amount,
        currency: p.currency,
        coresGranted: p.coresGranted,
        tier: p.tier,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total: stats.totalPayments,
      stats: { totalAmount: stats.totalAmount, totalCores: stats.totalCores, byProvider: stats.byProvider },
      pagination: { limit, skip, hasMore: payments.length === limit },
    }));
  } catch (error) {
    logger.error("❌ Error getting user payments:", error);
    const { statusCode, response } = createErrorResponse("Failed to retrieve payment history", 500, error.message);
    res.status(statusCode).json(response);
  }
}
