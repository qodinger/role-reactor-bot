import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";
import crypto from "crypto";

const logger = getLogger();

/**
 * Handle Coinbase Commerce webhook events
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function handleCryptoWebhook(req, res) {
  const startTime = Date.now();
  let webhookData = null;
  let processedType = "Unknown";
  let processingResult = { success: false, error: null };

  try {
    // ===== STEP 1: LOG REQUEST =====
    logger.info("🔔 Crypto Webhook Received - Starting Processing", {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      timestamp: new Date().toISOString(),
    });

    // Handle GET requests (health checks) - return OK status
    if (req.method === "GET") {
      return res.status(200).send("OK");
    }

    // Only process POST requests
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // ===== STEP 2: EXTRACT WEBHOOK DATA =====
    const rawBody = JSON.stringify(req.body);
    webhookData = req.body;

    // ===== STEP 3: VERIFY WEBHOOK SIGNATURE =====
    if (process.env.COINBASE_WEBHOOK_SECRET) {
      const signature = req.headers["x-cc-webhook-signature"];
      if (!signature) {
        logger.warn("❌ Webhook signature required but not provided");
        return res.status(200).send("OK"); // Return 200 to prevent retries
      }

      const expectedSignature = crypto
        .createHmac("sha256", process.env.COINBASE_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn("❌ Invalid webhook signature", {
          providedSignature: `${signature.substring(0, 10)}...`,
        });
        return res.status(200).send("OK"); // Return 200 to prevent retries
      }

      logger.info("✅ Webhook signature verified");
    }

    // ===== STEP 4: VALIDATE WEBHOOK DATA =====
    // Coinbase Commerce webhook structure:
    // {
    //   "attempt_number": 1,
    //   "event": {
    //     "type": "charge:confirmed",
    //     "data": { ...charge object... },
    //     ...
    //   },
    //   "id": "...",
    //   "scheduled_for": "..."
    // }
    if (!webhookData || !webhookData.event) {
      logger.warn("❌ Missing required field: event");
      return res.status(200).send("OK");
    }

    const event = webhookData.event;
    if (!event.type) {
      logger.warn("❌ Missing event type");
      return res.status(200).send("OK");
    }

    if (!event.data) {
      logger.warn("❌ Missing event data (charge object)");
      return res.status(200).send("OK");
    }

    // ===== STEP 5: LOG WEBHOOK DATA =====
    logger.info("📋 Full Webhook Data:", JSON.stringify(webhookData, null, 2));

    logger.info("🔍 Webhook Analysis:", {
      webhookId: webhookData.id,
      attemptNumber: webhookData.attempt_number,
      eventType: event.type,
      eventId: event.id,
      chargeId: event.data?.id,
      chargeCode: event.data?.code,
      timestamp: event.created_at,
      scheduledFor: webhookData.scheduled_for,
    });

    // ===== STEP 6: PROCESS WEBHOOK BASED ON TYPE =====

    switch (event.type) {
      case "charge:confirmed":
        processedType = "Payment Confirmed";
        processingResult = await processCryptoPayment(event.data);
        break;
      case "charge:failed":
        processedType = "Payment Failed";
        processingResult = await handleCryptoPaymentFailure(event.data);
        break;
      case "charge:pending":
        processedType = "Payment Pending";
        logger.info("⏳ Payment pending, waiting for confirmation");
        return res.status(200).json({ received: true, status: "pending" });
      default:
        logger.info(`ℹ️ Unhandled event type: ${event.type}`);
        return res.status(200).json({ received: true, status: "unhandled" });
    }

    // ===== STEP 7: SEND RESPONSE =====
    const duration = Date.now() - startTime;
    logger.info(
      `✅ Crypto webhook processed: ${processedType} in ${duration}ms`,
      {
        success: processingResult.success,
        duration,
      },
    );

    return res.status(200).json({
      received: true,
      processed: processingResult.success,
      type: processedType,
    });
  } catch (error) {
    logger.error("❌ Error processing crypto webhook:", error);
    return res.status(200).json({
      received: true,
      error: error.message,
    });
  }
}

/**
 * Process confirmed crypto payment
 * @param {Object} charge - Coinbase Commerce charge object
 * @returns {Promise<Object>} Processing result
 */
async function processCryptoPayment(charge) {
  try {
    logger.info("💰 Processing Crypto Payment:", {
      chargeId: charge.id,
      code: charge.code,
      pricingType: charge.pricing_type,
      localPrice: charge.pricing?.local,
      settlementPrice: charge.pricing?.settlement,
      metadata: charge.metadata,
      timeline: charge.timeline?.map(t => t.status) || [],
    });

    // Extract metadata
    const metadata = charge.metadata || {};
    let userId = metadata.discord_user_id;

    // Get email from metadata:
    // 1. discord_email (from our API when user is logged in)
    // 2. email (from Coinbase Commerce payment links that collect email - stored in metadata)
    const discordEmail = metadata.discord_email || metadata.email || null;

    const tier = metadata.tier;
    const paymentType = metadata.type || "payment";
    const amount = charge.pricing?.local?.amount || "0";
    const currency = charge.pricing?.local?.currency || "USD";
    const chargeId = charge.id;

    logger.debug("🔍 Customer identification:", {
      hasDiscordId: !!userId,
      hasEmail: !!discordEmail,
      emailSource: discordEmail
        ? metadata.discord_email
          ? "metadata.discord_email"
          : metadata.email
            ? "metadata.email"
            : "unknown"
        : "none",
    });

    // Try to find Discord user by email if no Discord ID
    if (!userId && discordEmail) {
      logger.debug("🔍 No Discord ID in metadata, trying email lookup...");
      userId = await findDiscordUserByEmail(discordEmail);
      if (userId) {
        logger.info(
          `✅ Found Discord user ${userId} via email ${discordEmail.substring(0, 3)}***`,
        );
      } else {
        logger.debug(
          "❌ No Discord user found for email, will store as pending",
        );
      }
    }

    // If still no Discord user ID, store as pending payment for manual verification
    if (!userId) {
      logger.warn(
        `⚠️ Payment without Discord ID detected: ${chargeId} - Storing as pending`,
      );

      // Store pending payment for manual verification
      const storage = await getStorageManager();
      const pendingPayments =
        (await storage.get("pending_crypto_payments")) || [];

      pendingPayments.push({
        chargeId,
        amount: parseFloat(amount),
        currency,
        tier: tier || null,
        paymentType,
        email: discordEmail || null, // Include email for manual matching
        timestamp: new Date().toISOString(),
        chargeData: {
          id: charge.id,
          code: charge.code,
          pricingType: charge.pricing_type,
        },
      });

      await storage.set("pending_crypto_payments", pendingPayments);

      logger.info(
        `📋 Pending payment stored: ${chargeId} - Admin can manually process using /core-management add`,
      );

      return {
        success: true,
        message:
          "Payment received but no Discord ID. Stored as pending for manual verification.",
        pending: true,
        chargeId,
      };
    }

    // Store email mapping for future payments
    if (discordEmail) {
      const storage = await getStorageManager();
      const emailMappings = (await storage.get("email_discord_mappings")) || {};
      const emailKey = discordEmail.toLowerCase().trim();
      if (!emailMappings[emailKey] || emailMappings[emailKey] !== userId) {
        emailMappings[emailKey] = userId;
        await storage.set("email_discord_mappings", emailMappings);
        logger.debug(
          `📧 Stored email mapping: ${emailKey.substring(0, 3)}*** -> ${userId}`,
        );
      }
    }

    // Check for duplicate processing
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

    // Check if this charge has already been processed
    const processedCharges =
      userData.cryptoPayments?.map(p => p.chargeId) || [];
    if (processedCharges.includes(chargeId)) {
      logger.warn(
        `⚠️ Duplicate crypto payment detected: ${chargeId} for user ${userId}`,
      );
      return {
        success: true,
        message: "Payment already processed (duplicate ignored)",
        credits: userData.credits || 0,
      };
    }

    // Calculate credits based on payment type
    let coresToAdd = 0;
    const paymentAmount = parseFloat(amount);

    // Load config dynamically
    const configModule = await import("../config/config.js").catch(() => null);
    const config =
      configModule?.config || configModule?.default || configModule || {};
    // All pricing values come from config - use package pricing
    const packages = config.corePricing?.packages || {};

    // Get minimum payment amount from config
    const minimumAmount = config.corePricing?.coreSystem?.minimumPayment;
    if (!minimumAmount) {
      logger.error("❌ Minimum payment amount not found in config");
      return {
        success: false,
        error: "Payment processing configuration error",
      };
    }

    // Calculate rate from packages (use $10 package as default)
    // If packages not available, calculate from smallest package
    let defaultRate = 0;
    if (packages.$10) {
      defaultRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
    } else if (packages.$5) {
      defaultRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;
    } else if (packages.$25) {
      defaultRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
    } else if (packages.$50) {
      defaultRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
    }

    if (!defaultRate) {
      logger.error(
        "❌ Unable to calculate default rate - no packages found in config",
      );
      return {
        success: false,
        error: "Payment processing configuration error",
      };
    }

    // Validate minimum payment amount
    if (paymentAmount < minimumAmount) {
      logger.warn(
        `❌ Payment below minimum: $${paymentAmount} < $${minimumAmount} (chargeId: ${chargeId})`,
      );
      return {
        success: false,
        error: `Payment amount ($${paymentAmount}) is below the minimum required amount ($${minimumAmount}). No credits will be granted.`,
      };
    }

    // One-time payment - calculate credits based on package pricing
    // Use tiered rates based on amount
    let paymentRate = defaultRate;
    if (paymentAmount >= 50 && packages.$50) {
      paymentRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
    } else if (paymentAmount >= 25 && packages.$25) {
      paymentRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
    } else if (paymentAmount >= 10 && packages.$10) {
      paymentRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
    } else if (paymentAmount >= 5 && packages.$5) {
      paymentRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;
    }
    coresToAdd = Math.floor(paymentAmount * paymentRate);

    // Add credits (simplified)
    userData.credits = formatCoreCredits((userData.credits || 0) + coresToAdd);
    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;

    // Track payment
    userData.cryptoPayments = userData.cryptoPayments || [];
    userData.cryptoPayments.push({
      chargeId,
      type: paymentType,
      tier: tier || null,
      amount: paymentAmount,
      currency,
      cores: coresToAdd,
      timestamp: new Date().toISOString(),
      processed: true,
    });

    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    await storage.set("core_credit", coreCredits);

    logger.info(
      `✅ Added ${coresToAdd} Cores to user ${userId} from crypto payment of ${paymentAmount} ${currency}`,
    );

    // Send confirmation DM (requires client instance)
    // Note: This would require passing the client to the webhook handler
    // Currently logging confirmation instead

    return {
      success: true,
      message: `Successfully processed crypto payment: ${paymentAmount} ${currency} = ${coresToAdd} Cores`,
      credits: coresToAdd,
      amount: paymentAmount,
      tier: tier || null,
    };
  } catch (error) {
    logger.error("❌ Error processing crypto payment:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle failed crypto payment
 * @param {Object} charge - Coinbase Commerce charge object
 * @returns {Promise<Object>} Processing result
 */
async function handleCryptoPaymentFailure(charge) {
  try {
    logger.warn("❌ Crypto Payment Failed:", {
      chargeId: charge.id,
      code: charge.code,
      pricingType: charge.pricing_type,
    });

    // Extract metadata
    const metadata = charge.metadata || {};
    const userId = metadata.discord_user_id;

    if (userId) {
      // Could send notification to user about failed payment
      logger.info(`Payment failed for user ${userId}`);
    }

    return {
      success: true,
      message: "Payment failure logged",
    };
  } catch (error) {
    logger.error("❌ Error handling crypto payment failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Find Discord user by email (if you have email mapping)
 * @param {string} email - Supporter email
 * @returns {Promise<string|null>} Discord user ID or null
 */
async function findDiscordUserByEmail(email) {
  if (!email) {
    logger.debug("🔍 findDiscordUserByEmail: No email provided");
    return null;
  }

  try {
    logger.debug("🔍 findDiscordUserByEmail: Looking up email", {
      emailPrefix: `${email.substring(0, 3)}***`,
      emailLength: email.length,
    });

    // Check email -> Discord ID mapping
    const storage = await getStorageManager();
    const emailMappings = (await storage.get("email_discord_mappings")) || {};
    const emailKey = email.toLowerCase().trim();

    logger.debug("🔍 Email mapping lookup:", {
      emailKey,
      totalMappings: Object.keys(emailMappings).length,
      hasMapping: !!emailMappings[emailKey],
    });

    const discordId = emailMappings[emailKey] || null;

    if (discordId) {
      logger.debug("✅ Discord ID found via email mapping:", discordId);
    } else {
      logger.debug("❌ No Discord ID found for email");
    }

    return discordId;
  } catch (error) {
    logger.error("Error finding Discord user by email:", error);
    logger.debug("🔍 Error details:", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    return null;
  }
}
