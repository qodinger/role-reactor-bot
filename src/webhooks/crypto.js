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
      order_number: orderNumber,
      amount,
      currency,
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
    } = data;

    // Order number format: USERID_TIMESTAMP
    const userId = orderNumber ? orderNumber.split("_")[0] : null;

    // Validate User ID
    if (!userId || !/^\d{17,20}$/.test(userId)) {
      logger.warn(`⚠️ Invalid User ID in Plisio order: ${orderNumber}`);
      // Fallback logic or manual check could be added here
    }

    // Use source amount (USD) if available, otherwise crypto amount
    const finalAmount = sourceAmount
      ? parseFloat(sourceAmount)
      : parseFloat(amount);
    const finalCurrency = sourceCurrency || currency;

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
  const packages = config.corePricing?.packages || {};
  const minimumAmount = config.corePricing?.coreSystem?.minimumPayment || 1;

  if (amount < minimumAmount) {
    return { success: false, error: "Below minimum amount" };
  }

  let paymentRate = 0;
  // Default rate logic
  if (packages.$10)
    paymentRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;

  // Tiered override
  if (amount >= 50 && packages.$50)
    paymentRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
  else if (amount >= 25 && packages.$25)
    paymentRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
  else if (amount >= 10 && packages.$10)
    paymentRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
  else if (amount >= 5 && packages.$5)
    paymentRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;

  if (paymentRate === 0) paymentRate = 100; // Fallback

  const coresToAdd = Math.floor(amount * paymentRate);

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

  logger.info(
    `✅ Added ${coresToAdd} Cores to user ${userId} (${provider} payment: $${amount})`,
  );
  return { success: true, message: "Credited", credits: coresToAdd };
}


