import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";

const logger = getLogger();

// Cache for PayPal access token
let accessTokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Get PayPal API base URL based on mode
 * @returns {string} PayPal API base URL
 */
function getPayPalBaseUrl() {
  const mode = process.env.PAYPAL_MODE || "sandbox";
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * Get PayPal access token for API calls
 * Uses caching to avoid unnecessary token requests
 * @returns {Promise<string|null>} Access token or null if failed
 */
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn("⚠️ PayPal credentials not configured");
    return null;
  }

  // Check if cached token is still valid (with 60 second buffer)
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt - 60000) {
    return accessTokenCache.token;
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("❌ Failed to get PayPal access token:", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();

    // Cache the token
    accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    logger.debug("✅ PayPal access token obtained successfully");
    return data.access_token;
  } catch (error) {
    logger.error("❌ Error getting PayPal access token:", error);
    return null;
  }
}

/**
 * Verify PayPal webhook signature using PayPal's API
 * @see https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} Whether signature is valid
 */
async function verifyPayPalWebhookSignature(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  // Skip verification in development if webhook ID not configured
  if (!webhookId) {
    if (process.env.NODE_ENV === "production") {
      logger.error("❌ PAYPAL_WEBHOOK_ID required in production");
      return false;
    }
    logger.warn("⚠️ PAYPAL_WEBHOOK_ID not configured - skipping verification (dev mode)");
    return true;
  }

  try {
    // Extract PayPal webhook headers
    const transmissionId = req.headers["paypal-transmission-id"];
    const transmissionTime = req.headers["paypal-transmission-time"];
    const certUrl = req.headers["paypal-cert-url"];
    const authAlgo = req.headers["paypal-auth-algo"];
    const transmissionSig = req.headers["paypal-transmission-sig"];

    // Validate all required headers are present
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      logger.warn("❌ Missing PayPal webhook headers", {
        hasTransmissionId: !!transmissionId,
        hasTransmissionTime: !!transmissionTime,
        hasCertUrl: !!certUrl,
        hasAuthAlgo: !!authAlgo,
        hasTransmissionSig: !!transmissionSig,
      });
      return false;
    }

    // Validate cert URL is from PayPal (basic security check before API call)
    try {
      const certUrlObj = new URL(certUrl);
      const validDomains = ["api.paypal.com", "api.sandbox.paypal.com"];
      if (!validDomains.some((domain) => certUrlObj.hostname.endsWith(domain))) {
        logger.warn("❌ Invalid PayPal certificate URL domain:", certUrl);
        return false;
      }
    } catch {
      logger.warn("❌ Invalid certificate URL format:", certUrl);
      return false;
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      logger.error("❌ Cannot verify webhook - failed to get access token");
      // In production, reject if we can't verify
      if (process.env.NODE_ENV === "production") {
        return false;
      }
      // In development, allow with warning
      logger.warn("⚠️ Allowing webhook without verification (dev mode)");
      return true;
    }

    // Call PayPal's webhook signature verification API
    const verificationPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: req.body,
    };

    logger.debug("🔍 Verifying PayPal webhook signature...", {
      transmissionId,
      webhookId,
      authAlgo,
    });

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verificationPayload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("❌ PayPal webhook verification API error:", {
        status: response.status,
        error: errorText,
      });
      return false;
    }

    const result = await response.json();

    // PayPal returns { verification_status: "SUCCESS" } or { verification_status: "FAILURE" }
    const isValid = result.verification_status === "SUCCESS";

    if (isValid) {
      logger.info("✅ PayPal webhook signature verified successfully");
    } else {
      logger.warn("❌ PayPal webhook signature verification failed", {
        status: result.verification_status,
      });
    }

    return isValid;
  } catch (error) {
    logger.error("❌ Error verifying PayPal webhook signature:", error);

    // In production, reject on error
    if (process.env.NODE_ENV === "production") {
      return false;
    }

    // In development, log error but allow processing
    logger.warn("⚠️ Allowing webhook despite verification error (dev mode)");
    return true;
  }
}

/**
 * Handle PayPal webhook events
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function handlePayPalWebhook(req, res) {
  const startTime = Date.now();
  let webhookData = null;
  let processedType = "Unknown";
  let processingResult = { success: false, error: null };

  try {
    // ===== STEP 1: LOG REQUEST =====
    logger.info("🔔 PayPal Webhook Received - Starting Processing", {
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

    // ===== STEP 2: VERIFY WEBHOOK SIGNATURE =====
    const isValid = await verifyPayPalWebhookSignature(req);
    if (!isValid) {
      logger.warn("❌ Invalid PayPal webhook signature");
      return res.status(200).send("OK"); // Return 200 to prevent retries
    }

    // ===== STEP 3: EXTRACT WEBHOOK DATA =====
    webhookData = req.body;

    if (!webhookData || !webhookData.event_type) {
      logger.warn("❌ Missing required field: event_type");
      return res.status(200).send("OK");
    }

    // ===== STEP 4: LOG WEBHOOK DATA =====
    logger.info("📋 PayPal Webhook Data:", {
      id: webhookData.id,
      event_type: webhookData.event_type,
      create_time: webhookData.create_time,
      resource_type: webhookData.resource_type,
    });

    logger.debug("🔍 Full PayPal Webhook:", JSON.stringify(webhookData, null, 2));

    // ===== STEP 5: PROCESS WEBHOOK BASED ON EVENT TYPE =====
    // PayPal event types: https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_event-types

    switch (webhookData.event_type) {
      // Order completed (Checkout v2)
      case "CHECKOUT.ORDER.COMPLETED":
        processedType = "Order Completed";
        processingResult = await processPayPalOrderCompleted(webhookData.resource);
        break;

      // Payment captured (Orders v2)
      case "PAYMENT.CAPTURE.COMPLETED":
        processedType = "Payment Captured";
        processingResult = await processPayPalPaymentCapture(webhookData.resource);
        break;

      // Payment sale completed (older integration)
      case "PAYMENT.SALE.COMPLETED":
        processedType = "Sale Completed";
        processingResult = await processPayPalSaleCompleted(webhookData.resource);
        break;

      // Payment denied/refunded
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.SALE.DENIED":
      case "PAYMENT.SALE.REFUNDED":
        processedType = "Payment Failed/Refunded";
        processingResult = await handlePayPalPaymentFailure(
          webhookData.resource,
          webhookData.event_type,
        );
        break;

      // Pending payments
      case "PAYMENT.CAPTURE.PENDING":
      case "PAYMENT.SALE.PENDING":
        processedType = "Payment Pending";
        logger.info("⏳ PayPal payment pending, waiting for completion");
        return res.status(200).json({ received: true, status: "pending" });

      default:
        logger.info(`ℹ️ Unhandled PayPal event type: ${webhookData.event_type}`);
        return res.status(200).json({ received: true, status: "unhandled" });
    }

    // ===== STEP 6: SEND RESPONSE =====
    const duration = Date.now() - startTime;
    logger.info(
      `✅ PayPal webhook processed: ${processedType} in ${duration}ms`,
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
    logger.error("❌ Error processing PayPal webhook:", error);
    return res.status(200).json({
      received: true,
      error: error.message,
    });
  }
}

/**
 * Process PayPal order completed event (Checkout v2)
 * @param {Object} resource - PayPal order resource
 * @returns {Promise<Object>} Processing result
 */
async function processPayPalOrderCompleted(resource) {
  try {
    logger.info("💰 Processing PayPal Order Completed:", {
      orderId: resource.id,
      status: resource.status,
      intent: resource.intent,
    });

    // Extract payment info from the order
    const purchaseUnit = resource.purchase_units?.[0];
    if (!purchaseUnit) {
      logger.warn("❌ No purchase units found in PayPal order");
      return { success: false, error: "No purchase units found" };
    }

    // Get amount info
    const amount = purchaseUnit.amount?.value || "0";
    const currency = purchaseUnit.amount?.currency_code || "USD";

    // Extract custom data (Discord user ID should be in custom_id or reference_id)
    // Your website should set this when creating the order
    const customId = purchaseUnit.custom_id || purchaseUnit.reference_id || null;

    // Try to extract Discord user ID from custom data
    let discordUserId = null;
    let tier = null;

    if (customId) {
      try {
        // Custom ID format: "discord_user_id:tier" or just "discord_user_id"
        // Or JSON: {"discord_user_id": "123", "tier": "$10"}
        if (customId.startsWith("{")) {
          const customData = JSON.parse(customId);
          discordUserId = customData.discord_user_id;
          tier = customData.tier;
        } else if (customId.includes(":")) {
          [discordUserId, tier] = customId.split(":");
        } else {
          discordUserId = customId;
        }
      } catch {
        discordUserId = customId;
      }
    }

    // Also check payer email for user lookup
    const payerEmail = resource.payer?.email_address;

    return await processPayPalPayment({
      paymentId: resource.id,
      discordUserId,
      amount: parseFloat(amount),
      currency,
      tier,
      payerEmail,
      paymentType: "order",
      rawResource: resource,
    });
  } catch (error) {
    logger.error("❌ Error processing PayPal order completed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Process PayPal payment capture event
 * @param {Object} resource - PayPal capture resource
 * @returns {Promise<Object>} Processing result
 */
async function processPayPalPaymentCapture(resource) {
  try {
    logger.info("💰 Processing PayPal Payment Capture:", {
      captureId: resource.id,
      status: resource.status,
      amount: resource.amount?.value,
      currency: resource.amount?.currency_code,
    });

    const amount = resource.amount?.value || "0";
    const currency = resource.amount?.currency_code || "USD";

    // Custom ID from the capture
    const customId = resource.custom_id || null;

    let discordUserId = null;
    let tier = null;

    if (customId) {
      try {
        if (customId.startsWith("{")) {
          const customData = JSON.parse(customId);
          discordUserId = customData.discord_user_id;
          tier = customData.tier;
        } else if (customId.includes(":")) {
          [discordUserId, tier] = customId.split(":");
        } else {
          discordUserId = customId;
        }
      } catch {
        discordUserId = customId;
      }
    }

    return await processPayPalPayment({
      paymentId: resource.id,
      discordUserId,
      amount: parseFloat(amount),
      currency,
      tier,
      payerEmail: null,
      paymentType: "capture",
      rawResource: resource,
    });
  } catch (error) {
    logger.error("❌ Error processing PayPal payment capture:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Process PayPal sale completed event (older API)
 * @param {Object} resource - PayPal sale resource
 * @returns {Promise<Object>} Processing result
 */
async function processPayPalSaleCompleted(resource) {
  try {
    logger.info("💰 Processing PayPal Sale Completed:", {
      saleId: resource.id,
      state: resource.state,
      amount: resource.amount?.total,
      currency: resource.amount?.currency,
    });

    const amount = resource.amount?.total || "0";
    const currency = resource.amount?.currency || "USD";
    const customId = resource.custom || null;

    let discordUserId = null;
    let tier = null;

    if (customId) {
      try {
        if (customId.startsWith("{")) {
          const customData = JSON.parse(customId);
          discordUserId = customData.discord_user_id;
          tier = customData.tier;
        } else if (customId.includes(":")) {
          [discordUserId, tier] = customId.split(":");
        } else {
          discordUserId = customId;
        }
      } catch {
        discordUserId = customId;
      }
    }

    return await processPayPalPayment({
      paymentId: resource.id,
      discordUserId,
      amount: parseFloat(amount),
      currency,
      tier,
      payerEmail: null,
      paymentType: "sale",
      rawResource: resource,
    });
  } catch (error) {
    logger.error("❌ Error processing PayPal sale completed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Process PayPal payment and add Cores
 * @param {Object} paymentData - Processed payment data
 * @returns {Promise<Object>} Processing result
 */
async function processPayPalPayment(paymentData) {
  const {
    paymentId,
    discordUserId,
    amount,
    currency,
    tier,
    payerEmail,
    paymentType,
  } = paymentData;

  try {
    // Get database manager for new repositories
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    let userId = discordUserId;

    // Try to find Discord user by email if no Discord ID
    if (!userId && payerEmail) {
      logger.debug("🔍 No Discord ID in metadata, trying email lookup...");
      userId = await findDiscordUserByEmail(payerEmail);
      if (userId) {
        logger.info(
          `✅ Found Discord user ${userId} via PayPal email ${payerEmail.substring(0, 3)}***`,
        );
      }

      // Also try the new UserRepository
      if (!userId && dbManager?.users) {
        const user = await dbManager.users.findByEmail(payerEmail);
        if (user) {
          userId = user.discordId;
          logger.info(
            `✅ Found Discord user ${userId} via UserRepository email lookup`,
          );
        }
      }
    }

    // If still no Discord user ID, store as pending payment
    if (!userId) {
      logger.warn(
        `⚠️ PayPal payment without Discord ID detected: ${paymentId} - Storing as pending`,
      );

      // Store in PaymentRepository if available, otherwise fallback to storage
      if (dbManager?.payments) {
        await dbManager.payments.create({
          paymentId,
          discordId: null, // No user linked yet
          provider: "paypal",
          type: paymentType,
          status: "pending_user",
          amount,
          currency,
          coresGranted: 0, // Will be granted when user is linked
          tier: tier || null,
          email: payerEmail || null,
          metadata: { awaitingUserLink: true },
        });
        logger.info(
          `📋 Pending PayPal payment stored in PaymentRepository: ${paymentId}`,
        );
      } else {
        // Fallback to old storage method
        const storage = await getStorageManager();
        const pendingPayments =
          (await storage.get("pending_paypal_payments")) || [];

        pendingPayments.push({
          paymentId,
          amount,
          currency,
          tier: tier || null,
          paymentType,
          email: payerEmail || null,
          timestamp: new Date().toISOString(),
        });

        await storage.set("pending_paypal_payments", pendingPayments);
        logger.info(
          `📋 Pending PayPal payment stored (legacy): ${paymentId}`,
        );
      }

      return {
        success: true,
        message:
          "Payment received but no Discord ID. Stored as pending for manual verification.",
        pending: true,
        paymentId,
      };
    }

    // Store email mapping for future payments
    if (payerEmail) {
      const storage = await getStorageManager();
      const emailMappings = (await storage.get("email_discord_mappings")) || {};
      const emailKey = payerEmail.toLowerCase().trim();
      if (!emailMappings[emailKey] || emailMappings[emailKey] !== userId) {
        emailMappings[emailKey] = userId;
        await storage.set("email_discord_mappings", emailMappings);
        logger.debug(
          `📧 Stored email mapping: ${emailKey.substring(0, 3)}*** -> ${userId}`,
        );
      }
    }

    // Check for duplicate processing using PaymentRepository
    if (dbManager?.payments) {
      const alreadyProcessed = await dbManager.payments.isProcessed(paymentId);
      if (alreadyProcessed) {
        logger.warn(
          `⚠️ Duplicate PayPal payment detected: ${paymentId} for user ${userId}`,
        );
        return {
          success: true,
          message: "Payment already processed (duplicate ignored)",
          duplicate: true,
        };
      }
    }

    // Calculate credits based on payment amount
    const configModule = await import("../config/config.js").catch(() => null);
    const config =
      configModule?.config || configModule?.default || configModule || {};
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

    // Validate minimum payment amount
    if (amount < minimumAmount) {
      logger.warn(
        `❌ PayPal payment below minimum: $${amount} < $${minimumAmount} (paymentId: ${paymentId})`,
      );
      return {
        success: false,
        error: `Payment amount ($${amount}) is below the minimum required amount ($${minimumAmount}). No credits will be granted.`,
      };
    }

    // Calculate rate from packages
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

    // Use tiered rates based on amount
    let paymentRate = defaultRate;
    if (amount >= 50 && packages.$50) {
      paymentRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
    } else if (amount >= 25 && packages.$25) {
      paymentRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
    } else if (amount >= 10 && packages.$10) {
      paymentRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
    } else if (amount >= 5 && packages.$5) {
      paymentRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;
    }

    const coresToAdd = Math.floor(amount * paymentRate);

    // Store payment record in PaymentRepository
    if (dbManager?.payments) {
      await dbManager.payments.create({
        paymentId,
        discordId: userId,
        provider: "paypal",
        type: paymentType,
        status: "completed",
        amount,
        currency,
        coresGranted: coresToAdd,
        tier: tier || null,
        email: payerEmail || null,
        metadata: {},
      });
      logger.debug(`📝 Payment record saved to PaymentRepository: ${paymentId}`);
    }

    // Update user's credit balance (using CoreCreditsRepository)
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    if (!coreCredits[userId]) {
      coreCredits[userId] = {
        credits: 0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        username: null,
      };
    }

    const userData = coreCredits[userId];
    userData.credits = formatCoreCredits((userData.credits || 0) + coresToAdd);
    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;
    userData.lastUpdated = new Date().toISOString();

    // Save updated credits
    await storage.set("core_credit", coreCredits);

    logger.info(
      `✅ Added ${coresToAdd} Cores to user ${userId} from PayPal payment of ${amount} ${currency}`,
    );

    return {
      success: true,
      message: `Successfully processed PayPal payment: ${amount} ${currency} = ${coresToAdd} Cores`,
      credits: coresToAdd,
      amount,
      tier: tier || null,
    };
  } catch (error) {
    logger.error("❌ Error processing PayPal payment:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle failed/refunded PayPal payment
 * @param {Object} resource - PayPal resource object
 * @param {string} eventType - The event type
 * @returns {Promise<Object>} Processing result
 */
async function handlePayPalPaymentFailure(resource, eventType) {
  try {
    logger.warn(`❌ PayPal Payment ${eventType}:`, {
      paymentId: resource.id,
      status: resource.status || resource.state,
      amount: resource.amount?.value || resource.amount?.total,
    });

    // If it's a refund, we might want to deduct credits
    if (eventType.includes("REFUNDED")) {
      const customId = resource.custom_id || resource.custom || null;
      if (customId) {
        logger.info(`⚠️ Refund detected for payment with customId: ${customId}`);
        // TODO: Implement credit deduction for refunds if needed
      }
    }

    return {
      success: true,
      message: `Payment ${eventType} logged`,
    };
  } catch (error) {
    logger.error("❌ Error handling PayPal payment failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Find Discord user by email
 * @param {string} email - PayPal email
 * @returns {Promise<string|null>} Discord user ID or null
 */
async function findDiscordUserByEmail(email) {
  if (!email) {
    return null;
  }

  try {
    const storage = await getStorageManager();
    const emailMappings = (await storage.get("email_discord_mappings")) || {};
    const emailKey = email.toLowerCase().trim();

    const discordId = emailMappings[emailKey] || null;

    if (discordId) {
      logger.debug("✅ Discord ID found via email mapping:", discordId);
    }

    return discordId;
  } catch (error) {
    logger.error("Error finding Discord user by email:", error);
    return null;
  }
}
