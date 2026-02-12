import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";
import { plisioPay } from "../utils/payments/plisio.js";

const logger = getLogger();

/**
 * Handle Crypto Webhook events (Plisio only)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function handleCryptoWebhook(req, res) {
  const startTime = Date.now();
  let processedType = "Unknown";
  let processingResult = { success: false, error: null };

  // Determine provider
  let provider = "Unknown";
  if (req.body && req.body.verify_hash) provider = "Plisio";

  try {
    // ===== STEP 1: LOG REQUEST =====
    logger.info(`🔔 ${provider} Webhook Received`, {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      timestamp: new Date().toISOString(),
    });

    if (req.method === "GET") return res.status(200).send("OK");
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    // ===== STEP 2: VERIFY SIGNATURE & EXTRACT DATA =====

    // --- PLISIO HANDLING ---
    if (provider === "Plisio") {
      const isValid = plisioPay.verifyWebhook(req.body);

      if (!isValid) {
        logger.warn("❌ Invalid Plisio signature");
        return res.status(200).send("OK");
      }

      const data = req.body;
      logger.info("📋 Plisio Webhook Data:", JSON.stringify(data, null, 2));

      // Check status
      if (data.status === "completed" || data.status === "mismatch") {
        processedType = `Plisio Payment ${data.status === "mismatch" ? "Mismatch (Accepted)" : "Confirmed"}`;
        processingResult = await processPlisioPayment(data);
      } else {
        processedType = `Plisio Status: ${data.status}`;
        logger.info(`ℹ️ Plisio payment status update: ${data.status}`);
        return res.status(200).send("OK");
      }
    } else {
      logger.warn("❌ Unknown webhook provider (missing signatures)");
      return res.status(200).send("OK");
    }

    // ===== STEP 3: SEND RESPONSE =====
    const duration = Date.now() - startTime;
    logger.info(
      `✅ ${provider} webhook processed: ${processedType} in ${duration}ms`,
      { success: processingResult.success, duration },
    );

    return res.status(200).json({
      received: true,
      processed: processingResult.success,
      type: processedType,
    });
  } catch (error) {
    logger.error(`❌ Error processing ${provider} webhook:`, error);
    return res.status(200).json({ received: true, error: error.message });
  }
}

// ------------------------------------------------------------------
// PROCESSORS
// ------------------------------------------------------------------

/**
 * Process confirmed Plisio payment
 * @param {Object} data - Plisio webhook data
 */
async function processPlisioPayment(data) {
  try {
    logger.info("💰 Processing Plisio Payment:", data);

    const {
      status,
      order_number: orderNumber,
      amount,
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
      source_rate: sourceRate,
      currency,
    } = data;

    // Order number format: USERID_TIMESTAMP
    const userId = orderNumber ? orderNumber.split("_")[0] : null;

    // Validate User ID
    if (!userId || !/^\d{17,20}$/.test(userId)) {
      logger.warn(`⚠️ Invalid User ID in Plisio order: ${orderNumber}`);
    }

    // Logic for Mismatch vs Completed:
    // If mismatch, use the actual received crypto (amount) * rate (source_rate)
    // If completed (exact match), use the source_amount (requested price)
    let finalAmount;
    if (status === "mismatch" && sourceRate && amount) {
      finalAmount = parseFloat(amount) * parseFloat(sourceRate);
      logger.info(
        `⚖️ Handling Mismatch: Paid ${finalAmount} ${sourceCurrency || "USD"} (Requested ${sourceAmount})`,
      );
    } else {
      finalAmount = sourceAmount
        ? parseFloat(sourceAmount)
        : parseFloat(amount);
    }

    const finalCurrency = sourceCurrency || currency || "USD";

    return await creditUserCore({
      userId,
      amount: finalAmount,
      currency: finalCurrency,
      paymentId: orderNumber, // Use orderNumber (unique)
      provider: "Plisio",
      metadata: { ...data },
      email: data.email || null,
    });
  } catch (error) {
    logger.error("❌ Error processing Plisio payment:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Core logic to credit a user's account
 */
async function creditUserCore({
  userId,
  amount,
  currency,
  paymentId,
  provider,
  metadata,
  email,
}) {
  if (!userId) {
    logger.warn(
      `⚠️ Payment without Discord ID (${provider}): ${paymentId} - Storing as pending`,
    );
    const storage = await getStorageManager();
    const pendingPayments =
      (await storage.get("pending_crypto_payments")) || [];

    pendingPayments.push({
      chargeId: paymentId,
      amount,
      currency,
      provider,
      email: email || null,
      timestamp: new Date().toISOString(),
      metadata,
    });

    await storage.set("pending_crypto_payments", pendingPayments);
    return { success: true, message: "Stored as pending", pending: true };
  }

  const storage = await getStorageManager();
  const coreCredits = (await storage.get("core_credit")) || {};

  if (!coreCredits[userId]) {
    coreCredits[userId] = {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      cryptoPayments: [],
      username: null,
    };
  }

  const userData = coreCredits[userId];
  const processedCharges = userData.cryptoPayments?.map(p => p.chargeId) || [];
  if (processedCharges.includes(paymentId)) {
    logger.warn(`⚠️ Duplicate payment detected: ${paymentId}`);
    return { success: true, message: "Duplicate ignored" };
  }

  // Calculate Credits (Using Config)
  const configModule = await import("../config/config.js").catch(() => null);
  const config =
    configModule?.config || configModule?.default || configModule || {};
  const minimumAmount = config.corePricing?.coreSystem?.minimumPayment || 1;

  if (amount < minimumAmount) {
    logger.warn(
      `⚠️ Payment $${amount} is below minimum $${minimumAmount}. Order: ${paymentId}`,
    );
    return { success: false, error: "Below minimum amount" };
  }

  const coresToAdd = config.calculateCores(amount);

  userData.credits = formatCoreCredits((userData.credits || 0) + coresToAdd);
  userData.cryptoPayments.push({
    chargeId: paymentId,
    type: "payment",
    amount,
    currency,
    cores: coresToAdd,
    provider,
    timestamp: new Date().toISOString(),
    processed: true,
  });

  userData.lastUpdated = new Date().toISOString();
  await storage.set("core_credit", coreCredits);

  // Also log to the separate payments collection (Ledger)
  try {
    await storage.createPayment({
      paymentId: paymentId,
      discordId: userId,
      provider: provider,
      type: "one_time",
      status: "completed",
      amount: parseFloat(amount),
      currency: currency,
      coresGranted: coresToAdd,
      email: email,
      metadata: metadata,
    });
    logger.info(`📝 Payment ${paymentId} logged to payments collection`);
  } catch (logError) {
    logger.error(
      `Failed to log payment ${paymentId} to payments collection:`,
      logError,
    );
  }

  logger.info(
    `✅ Added ${coresToAdd} Cores to user ${userId} (${provider} payment: $${amount})`,
  );
  return { success: true, message: "Credited", credits: coresToAdd };
}
