import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";
import { plisioPay } from "../utils/payments/plisio.js";

const logger = getLogger();

/**
 * Handle Crypto Payment Webhook (Plisio)
 */
export async function handleCryptoWebhook(req, res) {
  const {
    order_number: paymentId,
    status,
    amount,
    currency,
    email,
    metadata,
  } = req.body;

  // 1. Verify Webhook Signature (SECURITY CRITICAL)
  if (!plisioPay.verifyWebhook(req.body)) {
    logger.warn(`❌ Invalid Plisio webhook signature for payment ${paymentId}`);
    return res
      .status(401)
      .json({ status: "error", message: "Invalid signature" });
  }

  // 2. Filter for successful payment statuses
  if (status !== "completed" && status !== "mismatch") {
    return res.status(200).json({ status: "ignored" });
  }

  let userId = metadata?.discordId;

  // Fallback: Extract Discord ID from order_number if metadata is missing 
  // (Format: USERID_TIMESTAMP)
  if (!userId && paymentId && typeof paymentId === "string" && paymentId.includes("_")) {
    userId = paymentId.split("_")[0];
    logger.debug(`🔍 Extracted user ID ${userId} from Plisio payment ID ${paymentId}`);
  }

  if (!userId) {
    logger.warn(`⚠️ Crypto payment without Discord ID: ${paymentId}`);
    return res.status(200).json({ status: "no_user_linked" });
  }

  try {
    const result = await processCryptoPayment(
      userId,
      paymentId,
      amount,
      currency,
      email,
      metadata,
    );
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`❌ Failed to process crypto payment ${paymentId}:`, error);
    return res.status(500).json({ status: "error", error: error.message });
  }
}

/**
 * Atomic processing of Crypto payment
 */
async function processCryptoPayment(
  userId,
  paymentId,
  amount,
  currency,
  _email,
  _metadata,
) {
  // We use the same locking mechanism as AI credits to prevent races
  const { withCreditLock } = await import("../utils/ai/aiCreditManager.js");

  return withCreditLock(userId, async () => {
    const storage = await getStorageManager();
    const configModule = await import("../config/config.js").catch(() => null);
    const config =
      configModule?.config || configModule?.default || configModule || {};

    // Check for duplicate payment
    const existingData = await storage.getCoreCredits(userId);
    if (existingData?.cryptoPayments?.some(p => p.chargeId === paymentId)) {
      return { success: true, message: "Already processed" };
    }

    const userData = existingData || {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    const minimumAmount = config.corePricing?.coreSystem?.minimumPayment || 1.0;
    const paymentAmount = parseFloat(amount);

    if (paymentAmount < minimumAmount) {
      logger.warn(
        `❌ Crypto payment below minimum: $${paymentAmount} < $${minimumAmount}`,
      );
      return { success: false, error: "Below minimum amount" };
    }

    // Use centralized calculateCores method from config
    const coresToAdd =
      typeof config.calculateCores === "function"
        ? config.calculateCores(paymentAmount)
        : Math.floor(
            paymentAmount *
              (config.corePricing?.coreSystem?.conversionRate || 50),
          );

    // Update balance and historical total
    userData.credits = formatCoreCredits((userData.credits || 0) + coresToAdd);
    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;

    // Track the crypto specific payment metadata
    if (!userData.cryptoPayments) userData.cryptoPayments = [];
    userData.cryptoPayments.push({
      chargeId: paymentId,
      type: "payment",
      amount: paymentAmount,
      currency,
      cores: coresToAdd,
      provider: "plisio",
      timestamp: new Date().toISOString(),
      processed: true,
    });

    userData.lastUpdated = new Date().toISOString();
    await storage.setCoreCredits(userId, userData);

    // Update separate payments ledger
    try {
      await storage.createPayment({
        paymentId: paymentId,
        discordId: userId,
        provider: "plisio",
        type: "one_time",
        status: "completed",
        amount: paymentAmount,
        currency: currency,
        coresGranted: coresToAdd,
        email: _email,
        metadata: _metadata,
      });
      logger.debug(`📝 Payment ${paymentId} logged to payments collection`);
    } catch (logError) {
      logger.error(
        `Failed to log payment ${paymentId} to payments collection:`,
        logError,
      );
    }

    logger.info(
      `✅ Added ${coresToAdd} Cores to user ${userId} via Crypto ($${paymentAmount})`,
    );

    // Create in-app notification
    try {
      const { getDatabaseManager } = await import(
        "../utils/storage/databaseManager.js"
      );
      const dbManager = await getDatabaseManager();
      if (dbManager?.notifications) {
        await dbManager.notifications.create({
          userId,
          type: "balance_added",
          title: "Balance Replenished!",
          message: `+${coresToAdd} Cores from your $${paymentAmount} crypto purchase`,
          icon: "core",
          metadata: {
            coresGranted: coresToAdd,
            amount: paymentAmount,
            provider: "plisio",
          },
        });
      }
    } catch (_e) {
      /* non-critical */
    }

    return { success: true, message: "Credited", credits: coresToAdd };
  });
}
