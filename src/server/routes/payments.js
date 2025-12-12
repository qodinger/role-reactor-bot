import express from "express";
import { getLogger } from "../../utils/logger.js";
import { config } from "../../config/config.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();
const router = express.Router();

/**
 * Create Coinbase Commerce payment link
 * POST /api/payments/create
 * Body: { type: "donation" | "subscription", amount?: number, tier?: string }
 */
router.post("/create", async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.discordUser) {
      return res
        .status(401)
        .json(createErrorResponse("Not authenticated", 401).response);
    }

    const { type, amount, tier } = req.body;
    const userId = req.session.discordUser.id;

    // Validate request
    if (!type || (type !== "donation" && type !== "subscription")) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "Invalid payment type",
            400,
            "Type must be 'donation' or 'subscription'",
          ).response,
        );
    }

    // Check if crypto payments are enabled
    if (
      !process.env.COINBASE_ENABLED ||
      process.env.COINBASE_ENABLED !== "true"
    ) {
      return res
        .status(503)
        .json(
          createErrorResponse("Cryptocurrency payments not enabled", 503)
            .response,
        );
    }

    const apiKey = process.env.COINBASE_API_KEY;
    if (!apiKey) {
      logger.error("COINBASE_API_KEY not configured");
      return res
        .status(500)
        .json(
          createErrorResponse("Payment system not configured", 500).response,
        );
    }

    // Calculate price and credits
    let price = 0;
    let credits = 0;
    let description = "";

    if (type === "subscription") {
      if (!tier) {
        return res
          .status(400)
          .json(
            createErrorResponse("Tier required for subscription", 400).response,
          );
      }

      const tierInfo = config.corePricing.subscriptions[tier];
      if (!tierInfo) {
        return res
          .status(400)
          .json(createErrorResponse(`Invalid tier: ${tier}`, 400).response);
      }

      price = tierInfo.price;
      credits = tierInfo.cores;
      description = `Monthly subscription for ${tier}`;
    } else {
      // Donation
      if (!amount || amount < 1) {
        return res
          .status(400)
          .json(
            createErrorResponse("Amount must be at least $1", 400).response,
          );
      }

      price = amount;
      credits = Math.floor(amount * config.corePricing.donation.rate);
      description = "One-time Core credits purchase";
    }

    // Create Coinbase Commerce charge
    const chargeData = {
      name: tier ? `${tier} Core Membership` : "Core Credits",
      description,
      pricing_type: "fixed_price",
      local_price: {
        amount: price.toString(),
        currency: "USD",
      },
      metadata: {
        discord_user_id: userId,
        tier: tier || null,
        type,
      },
    };

    const response = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify(chargeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Coinbase Commerce API error: ${response.status} - ${errorText}`,
      );
      return res
        .status(500)
        .json(createErrorResponse("Failed to create payment", 500).response);
    }

    const charge = await response.json();
    const paymentUrl = charge.data?.hosted_url;

    if (!paymentUrl) {
      return res
        .status(500)
        .json(
          createErrorResponse("Failed to create payment URL", 500).response,
        );
    }

    logger.info(`Payment created for user ${userId}: ${type} - $${price}`);

    res.json(
      createSuccessResponse({
        paymentUrl,
        chargeId: charge.data?.id,
        amount: price,
        credits,
        type,
        tier: tier || null,
      }),
    );
  } catch (error) {
    logger.error("Error creating payment:", error);
    res
      .status(500)
      .json(createErrorResponse("Failed to create payment", 500).response);
  }
});

/**
 * Get user's payment history
 * GET /api/payments/history
 */
router.get("/history", async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.discordUser) {
      return res
        .status(401)
        .json(createErrorResponse("Not authenticated", 401).response);
    }

    const userId = req.session.discordUser.id;

    // Get user's payment history from storage
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {};
    const payments = userData.cryptoPayments || [];

    res.json(
      createSuccessResponse({
        payments: payments.map(p => ({
          chargeId: p.chargeId,
          type: p.type,
          tier: p.tier,
          amount: p.amount,
          currency: p.currency,
          cores: p.cores,
          timestamp: p.timestamp,
        })),
        totalPayments: payments.length,
        totalSpent: payments.reduce((sum, p) => sum + p.amount, 0),
        totalCredits: userData.credits || 0,
      }),
    );
  } catch (error) {
    logger.error("Error getting payment history:", error);
    res
      .status(500)
      .json(createErrorResponse("Failed to get payment history", 500).response);
  }
});

/**
 * Get payment status
 * GET /api/payments/status/:chargeId
 */
router.get("/status/:chargeId", async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.discordUser) {
      return res
        .status(401)
        .json(createErrorResponse("Not authenticated", 401).response);
    }

    const { chargeId } = req.params;
    const userId = req.session.discordUser.id;

    // Check Coinbase Commerce API key
    const apiKey = process.env.COINBASE_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json(
          createErrorResponse("Payment system not configured", 500).response,
        );
    }

    // Get charge status from Coinbase Commerce
    const response = await fetch(
      `https://api.commerce.coinbase.com/charges/${chargeId}`,
      {
        headers: {
          "X-CC-Api-Key": apiKey,
          "X-CC-Version": "2018-03-22",
        },
      },
    );

    if (!response.ok) {
      return res
        .status(404)
        .json(createErrorResponse("Payment not found", 404).response);
    }

    const charge = await response.json();
    const chargeData = charge.data;

    // Verify charge belongs to user
    if (chargeData.metadata?.discord_user_id !== userId) {
      return res
        .status(403)
        .json(
          createErrorResponse("Payment does not belong to you", 403).response,
        );
    }

    // Get latest timeline status
    const latestStatus =
      chargeData.timeline?.[chargeData.timeline.length - 1]?.status;

    // Extract settlement currency (which crypto was actually used)
    const settlementCurrency = chargeData.pricing?.settlement?.currency;
    const settlementAmount = chargeData.pricing?.settlement?.amount;

    // Extract network/chain info from web3_data if available
    const chainId = chargeData.web3_data?.transfer_intent?.metadata?.chain_id;
    const inputTokenAddress =
      chargeData.web3_data?.success_events?.[0]?.input_token_address;

    res.json(
      createSuccessResponse({
        chargeId: chargeData.id,
        code: chargeData.code,
        status: latestStatus,
        amount: chargeData.pricing?.local?.amount,
        currency: chargeData.pricing?.local?.currency,
        settlementCurrency: settlementCurrency || null,
        settlementAmount: settlementAmount || null,
        chainId: chainId || null,
        inputTokenAddress: inputTokenAddress || null,
        createdAt: chargeData.created_at,
        expiresAt: chargeData.expires_at,
        confirmedAt: chargeData.confirmed_at || null,
        timeline: chargeData.timeline || [],
      }),
    );
  } catch (error) {
    logger.error("Error getting payment status:", error);
    res
      .status(500)
      .json(createErrorResponse("Failed to get payment status", 500).response);
  }
});

export default router;
