import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { config } from "../config/config.js";

const logger = getLogger();

/**
 * Handle Buy Me a Coffee webhook
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function handleBuyMeACoffeeWebhook(req, res) {
  const startTime = Date.now();
  let webhookData = null;
  let processedType = "Unknown";

  try {
    logger.info("🔔 Buy Me a Coffee Webhook Received", {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      timestamp: new Date().toISOString(),
    });

    // Handle GET requests (health checks)
    if (req.method === "GET") {
      return res.status(200).send("OK");
    }

    // Only process POST requests
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // Extract webhook data
    webhookData = req.body;

    // Log request details for debugging
    logger.debug("🔍 Webhook Request Details:", {
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
        host: req.headers["host"],
      },
      bodyKeys: webhookData ? Object.keys(webhookData) : [],
      bodySize: JSON.stringify(webhookData).length,
      ip: req.ip || req.connection?.remoteAddress,
    });

    // Validate webhook data
    if (!webhookData || !webhookData.type) {
      logger.warn("❌ Missing required field: type");
      logger.debug("🔍 Webhook data structure:", {
        hasData: !!webhookData,
        dataType: typeof webhookData,
        keys: webhookData ? Object.keys(webhookData) : [],
      });
      return res.status(200).send("OK");
    }

    logger.info("📋 Full Webhook Data:", JSON.stringify(webhookData, null, 2));

    // Process based on webhook type
    const webhookType = webhookData.type;
    logger.debug("🔍 Webhook Type:", webhookType);

    // Extract nested data if present (Buy Me a Coffee uses nested structure)
    const paymentData = webhookData.data || webhookData;
    logger.debug("🔍 Payment Data Structure:", {
      hasNestedData: !!webhookData.data,
      paymentDataKeys: Object.keys(paymentData),
    });

    let processingResult = { success: false, error: null };

    switch (webhookType) {
      case "support":
      case "donation.created":
        processedType = "Donation";
        processingResult = await processDonation(paymentData);
        break;

      case "membership":
      case "membership.created":
        processedType = "Subscription";
        processingResult = await processSubscription(paymentData);
        break;

      case "membership_cancelled":
      case "membership.cancelled":
        processedType = "Subscription Cancelled";
        processingResult = await processSubscriptionCancellation(paymentData);
        break;

      default:
        logger.info(`ℹ️ Unhandled webhook type: ${webhookType}`);
        return res.status(200).send("OK");
    }

    const processingTime = Date.now() - startTime;
    logger.info(`✅ Webhook processed: ${processedType}`, {
      success: processingResult.success,
      processingTime: `${processingTime}ms`,
    });

    return res.status(200).send("OK");
  } catch (error) {
    logger.error("❌ Error processing Buy Me a Coffee webhook:", error);
    return res.status(200).send("OK"); // Return 200 to prevent retries
  }
}

/**
 * Process donation webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} Processing result
 */
async function processDonation(data) {
  try {
    logger.info("💰 Processing Donation:", JSON.stringify(data, null, 2));

    // Extract data (Buy Me a Coffee webhook structure may vary)
    // Support both nested (data object) and flat structures
    const amount = parseFloat(data.amount || data.payment_amount || 0);
    const currency = data.currency || "USD";
    const supporterName = data.supporter_name || data.name || "Anonymous";
    // Check support_note, message, and note fields
    const message = data.support_note || data.message || data.note || "";
    const email = data.supporter_email || data.email || "";
    const transactionId = data.transaction_id || data.payment_id || data.id;
    // Handle Unix timestamp (seconds) or ISO string
    const createdAt = data.created_at || data.timestamp;
    const timestamp = createdAt
      ? typeof createdAt === "number"
        ? new Date(createdAt * 1000).toISOString()
        : createdAt
      : new Date().toISOString();

    logger.debug("🔍 Extracted Donation Data:", {
      amount,
      currency,
      supporterName,
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
      email: email ? `${email.substring(0, 3)}***` : "none",
      transactionId,
      timestamp,
      rawAmount: data.amount || data.payment_amount,
      rawCurrency: data.currency,
      rawSupportNote: data.support_note,
      rawMessage: data.message,
      rawNote: data.note,
    });

    if (!amount || amount <= 0) {
      logger.warn("❌ Invalid donation amount");
      logger.debug("🔍 Amount validation failed:", {
        parsedAmount: amount,
        rawAmount: data.amount || data.payment_amount,
        rawPaymentAmount: data.payment_amount,
      });
      return { success: false, error: "Invalid donation amount" };
    }

    logger.debug("🔍 Attempting to extract Discord user ID...");
    logger.debug("🔍 Message content:", {
      message,
      messageLength: message.length,
    });
    logger.debug("🔍 Email for lookup:", {
      email: email ? `${email.substring(0, 3)}***` : "none",
    });

    // Extract Discord user ID from message or email
    const discordUserIdFromMessage = extractDiscordUserId(message);
    logger.debug(
      "🔍 Discord ID from message:",
      discordUserIdFromMessage || "not found",
    );

    const discordUserIdFromEmail = await findDiscordUserByEmail(email);
    logger.debug(
      "🔍 Discord ID from email:",
      discordUserIdFromEmail || "not found",
    );

    const discordUserId = discordUserIdFromMessage || discordUserIdFromEmail;

    if (!discordUserId) {
      logger.warn(
        `⚠️ No Discord user ID found for donation from ${supporterName}. Storing as pending.`,
      );

      // Store as pending for manual verification
      const storage = await getStorageManager();
      const storedPayments = await storage.get("pending_bmac_payments");

      // Ensure it's always an array - defensive check
      let pendingPayments = [];
      if (Array.isArray(storedPayments)) {
        pendingPayments = storedPayments;
      } else if (storedPayments !== null && storedPayments !== undefined) {
        // If it's not null/undefined but also not an array, log it and reset
        logger.warn("⚠️ pending_bmac_payments is not an array, resetting:", {
          type: typeof storedPayments,
          value: storedPayments,
        });
        pendingPayments = [];
      }

      logger.debug("🔍 Storing pending payment:", {
        transactionId,
        amount,
        currency,
        supporterName,
        email: email ? `${email.substring(0, 3)}***` : "none",
        messageLength: message.length,
        existingPendingCount: pendingPayments.length,
        storedType: typeof storedPayments,
        isArray: Array.isArray(storedPayments),
        pendingPaymentsType: typeof pendingPayments,
        pendingPaymentsIsArray: Array.isArray(pendingPayments),
      });

      // Final safety check before push
      if (!Array.isArray(pendingPayments)) {
        logger.error(
          "❌ Critical: pendingPayments is still not an array after conversion!",
        );
        pendingPayments = [];
      }

      pendingPayments.push({
        transactionId,
        amount,
        currency,
        supporterName,
        email,
        message,
        timestamp,
        type: "donation",
      });

      await storage.set("pending_bmac_payments", pendingPayments);
      logger.debug("✅ Pending payment stored successfully");

      return {
        success: true,
        message:
          "Payment received but no Discord ID. Stored as pending for manual verification.",
        pending: true,
        transactionId,
      };
    }

    // Calculate Cores (10 Cores per $1 for donations)
    const donationRate = config.corePricing.donation.rate;
    const cores = Math.floor(amount * donationRate);

    logger.debug("💰 Credit Calculation:", {
      amount,
      donationRate,
      calculatedCores: amount * donationRate,
      finalCores: cores,
      discordUserId,
    });

    // Update user credits
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[discordUserId] || {
      credits: 0,
      bonusCredits: 0,
      subscriptionCredits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    logger.debug("🔍 User Data Before Update:", {
      discordUserId,
      currentCredits: userData.credits,
      currentBonusCredits: userData.bonusCredits,
      currentSubscriptionCredits: userData.subscriptionCredits,
      isCore: userData.isCore,
    });

    // Add as bonus credits (donations never expire)
    const previousCredits = userData.credits || 0;
    const previousBonusCredits = userData.bonusCredits || 0;
    userData.credits = previousCredits + cores;
    userData.bonusCredits = previousBonusCredits + cores;
    userData.lastUpdated = new Date().toISOString();

    logger.debug("🔍 User Data After Update:", {
      discordUserId,
      previousCredits,
      previousBonusCredits,
      newCredits: userData.credits,
      newBonusCredits: userData.bonusCredits,
      coresAdded: cores,
    });

    coreCredits[discordUserId] = userData;
    await storage.set("core_credit", coreCredits);
    logger.debug("✅ User credits updated in storage");

    logger.info(
      `✅ Donation processed: $${amount} = ${cores} Cores for user ${discordUserId}`,
    );

    return {
      success: true,
      message: `Successfully processed donation: $${amount} = ${cores} Cores`,
      credits: cores,
      amount,
    };
  } catch (error) {
    logger.error("❌ Error processing donation:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Process subscription webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} Processing result
 */
async function processSubscription(data) {
  try {
    logger.info("🔄 Processing Subscription:", JSON.stringify(data, null, 2));

    // Extract data (Buy Me a Coffee webhook structure may vary)
    // Support both nested (data object) and flat structures
    const amount = parseFloat(data.amount || data.payment_amount || 0);
    const currency = data.currency || "USD";
    const supporterName = data.supporter_name || data.name || "Anonymous";
    const email = data.supporter_email || data.email || "";
    // Check support_note, message, and note fields
    const message = data.support_note || data.message || data.note || "";
    const membershipTier = data.membership_tier || data.tier_name || "";
    const transactionId = data.transaction_id || data.payment_id || data.id;
    const isFirstPayment = data.is_first_payment || false;
    // Handle Unix timestamp (seconds) or ISO string
    const createdAt = data.created_at || data.timestamp;
    const timestamp = createdAt
      ? typeof createdAt === "number"
        ? new Date(createdAt * 1000).toISOString()
        : createdAt
      : new Date().toISOString();

    logger.debug("🔍 Extracted Subscription Data:", {
      amount,
      currency,
      supporterName,
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
      email: email ? `${email.substring(0, 3)}***` : "none",
      membershipTier,
      transactionId,
      isFirstPayment,
      timestamp,
      rawAmount: data.amount || data.payment_amount,
      rawMembershipTier: data.membership_tier || data.tier_name,
      rawSupportNote: data.support_note,
      rawMessage: data.message,
      rawNote: data.note,
    });

    if (!amount || amount <= 0) {
      logger.warn("❌ Invalid subscription amount");
      logger.debug("🔍 Amount validation failed:", {
        parsedAmount: amount,
        rawAmount: data.amount || data.payment_amount,
        rawPaymentAmount: data.payment_amount,
      });
      return { success: false, error: "Invalid subscription amount" };
    }

    logger.debug("🔍 Attempting to extract Discord user ID...");
    logger.debug("🔍 Message content:", {
      message,
      messageLength: message.length,
    });
    logger.debug("🔍 Email for lookup:", {
      email: email ? `${email.substring(0, 3)}***` : "none",
    });

    // Extract Discord user ID
    const discordUserIdFromMessage = extractDiscordUserId(message);
    logger.debug(
      "🔍 Discord ID from message:",
      discordUserIdFromMessage || "not found",
    );

    const discordUserIdFromEmail = await findDiscordUserByEmail(email);
    logger.debug(
      "🔍 Discord ID from email:",
      discordUserIdFromEmail || "not found",
    );

    const discordUserId = discordUserIdFromMessage || discordUserIdFromEmail;

    if (!discordUserId) {
      logger.warn(
        `⚠️ No Discord user ID found for subscription from ${supporterName}. Storing as pending.`,
      );

      // Store as pending
      const storage = await getStorageManager();
      const storedPayments = await storage.get("pending_bmac_payments");

      // Ensure it's always an array - defensive check
      let pendingPayments = [];
      if (Array.isArray(storedPayments)) {
        pendingPayments = storedPayments;
      } else if (storedPayments !== null && storedPayments !== undefined) {
        // If it's not null/undefined but also not an array, log it and reset
        logger.warn("⚠️ pending_bmac_payments is not an array, resetting:", {
          type: typeof storedPayments,
          value: storedPayments,
        });
        pendingPayments = [];
      }

      // Final safety check before push
      if (!Array.isArray(pendingPayments)) {
        logger.error(
          "❌ Critical: pendingPayments is still not an array after conversion!",
        );
        pendingPayments = [];
      }

      logger.debug("🔍 Storing pending subscription:", {
        transactionId,
        amount,
        currency,
        supporterName,
        email: email ? `${email.substring(0, 3)}***` : "none",
        messageLength: message.length,
        membershipTier,
        existingPendingCount: pendingPayments.length,
        storedType: typeof storedPayments,
        isArray: Array.isArray(storedPayments),
      });

      pendingPayments.push({
        transactionId,
        amount,
        currency,
        supporterName,
        email,
        message,
        membershipTier,
        isFirstPayment,
        timestamp,
        type: "subscription",
      });

      await storage.set("pending_bmac_payments", pendingPayments);
      logger.debug("✅ Pending subscription stored successfully");

      return {
        success: true,
        message:
          "Subscription received but no Discord ID. Stored as pending for manual verification.",
        pending: true,
        transactionId,
      };
    }

    // Map membership tier to Core tier
    logger.debug("🔍 Mapping membership tier to Core tier...", {
      amount,
      membershipTier,
      availableTiers: Object.keys(config.corePricing.subscriptions),
    });

    const detectedTier = mapMembershipTierToCoreTier(amount, membershipTier);
    logger.debug("🔍 Detected tier:", detectedTier);

    const tierInfo = config.corePricing.subscriptions[detectedTier];

    if (!tierInfo) {
      logger.warn(`❌ Unknown tier for amount $${amount}`);
      logger.debug("🔍 Tier mapping failed:", {
        amount,
        membershipTier,
        detectedTier,
        availableTiers: Object.keys(config.corePricing.subscriptions),
      });
      return { success: false, error: `Unknown tier for amount $${amount}` };
    }

    const monthlyCredits = tierInfo.cores;
    logger.debug("🔍 Tier Information:", {
      tier: detectedTier,
      monthlyCredits,
      tierInfo,
    });

    // Update user credits
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[discordUserId] || {
      credits: 0,
      bonusCredits: 0,
      subscriptionCredits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    logger.debug("🔍 User Data Before Update:", {
      discordUserId,
      currentCredits: userData.credits,
      currentBonusCredits: userData.bonusCredits,
      currentSubscriptionCredits: userData.subscriptionCredits,
      isCore: userData.isCore,
      existingSubscription: userData.bmacSubscription,
    });

    const isFirstSubscription = !userData.bmacSubscription?.isActive;
    logger.debug("🔍 Subscription Status:", {
      isFirstSubscription,
      isFirstPayment,
      hasActiveSubscription: !!userData.bmacSubscription?.isActive,
    });

    if (isFirstSubscription || isFirstPayment) {
      // First subscription: Set Cores to monthly allowance
      logger.debug("🆕 First subscription - setting initial credits");
      userData.credits = monthlyCredits;
      userData.subscriptionCredits = monthlyCredits;
      userData.bonusCredits = 0;
      userData.isCore = true;
      userData.coreTier = detectedTier;
    } else {
      // Subsequent payments: Reset subscription allowance, preserve bonus Cores
      logger.debug("🔄 Subsequent payment - preserving bonus credits");
      const bonusCredits = userData.bonusCredits || 0;
      userData.credits = monthlyCredits + bonusCredits;
      userData.subscriptionCredits = monthlyCredits;
      logger.debug("🔍 Credit calculation:", {
        monthlyCredits,
        bonusCredits,
        totalCredits: userData.credits,
      });
    }

    // Track subscription
    const previousProcessedTransactions =
      userData.bmacSubscription?.processedTransactions || [];
    const isDuplicate = previousProcessedTransactions.includes(transactionId);

    logger.debug("🔍 Transaction Tracking:", {
      transactionId,
      isDuplicate,
      previousProcessedCount: previousProcessedTransactions.length,
      previousTransactions: previousProcessedTransactions.slice(-5), // Last 5
    });

    if (isDuplicate) {
      logger.warn(`⚠️ Duplicate transaction detected: ${transactionId}`);
    }

    userData.bmacSubscription = {
      tier: detectedTier,
      isActive: true,
      transactionId,
      lastPayment: timestamp,
      monthlyCredits,
      subscriptionStartDate: isFirstSubscription
        ? timestamp
        : userData.bmacSubscription?.subscriptionStartDate || timestamp,
      processedTransactions: previousProcessedTransactions,
    };

    // Track this transaction to prevent duplicates
    if (!isDuplicate) {
      userData.bmacSubscription.processedTransactions.push(transactionId);
      logger.debug("✅ Transaction added to processed list");
    }

    logger.debug("🔍 User Data After Update:", {
      discordUserId,
      newCredits: userData.credits,
      newBonusCredits: userData.bonusCredits,
      newSubscriptionCredits: userData.subscriptionCredits,
      isCore: userData.isCore,
      coreTier: userData.coreTier,
      subscription: userData.bmacSubscription,
    });

    userData.lastUpdated = new Date().toISOString();
    coreCredits[discordUserId] = userData;
    await storage.set("core_credit", coreCredits);
    logger.debug("✅ User subscription updated in storage");

    logger.info(
      `✅ Subscription processed: $${amount}/month = ${monthlyCredits} Cores for user ${discordUserId} (${detectedTier})`,
    );

    return {
      success: true,
      message: `Successfully processed subscription: $${amount}/month = ${monthlyCredits} Cores`,
      credits: monthlyCredits,
      amount,
      tier: detectedTier,
    };
  } catch (error) {
    logger.error("❌ Error processing subscription:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Process subscription cancellation
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} Processing result
 */
async function processSubscriptionCancellation(data) {
  try {
    logger.info(
      "❌ Processing Subscription Cancellation:",
      JSON.stringify(data, null, 2),
    );

    const email = data.supporter_email || data.email || "";
    // Check support_note, message, and note fields
    const message = data.support_note || data.message || data.note || "";

    // Find Discord user ID
    const discordUserId =
      extractDiscordUserId(message) || (await findDiscordUserByEmail(email));

    if (!discordUserId) {
      logger.warn(
        "⚠️ Could not find Discord user for subscription cancellation",
      );
      return { success: false, error: "Discord user not found" };
    }

    // Update user subscription status
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[discordUserId];

    if (userData?.bmacSubscription) {
      userData.bmacSubscription.isActive = false;
      userData.bmacSubscription.cancelledAt = new Date().toISOString();
      // Don't remove subscription credits immediately - let them expire naturally
      coreCredits[discordUserId] = userData;
      await storage.set("core_credit", coreCredits);

      logger.info(`✅ Subscription cancelled for user ${discordUserId}`);
    }

    return { success: true, message: "Subscription cancelled" };
  } catch (error) {
    logger.error("❌ Error processing cancellation:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract Discord user ID from message
 * @param {string} message - Payment message/note
 * @returns {string|null} Discord user ID or null
 */
function extractDiscordUserId(message) {
  if (!message) {
    logger.debug("🔍 extractDiscordUserId: No message provided");
    return null;
  }

  logger.debug("🔍 extractDiscordUserId: Searching for Discord ID in message", {
    messageLength: message.length,
    messagePreview: message.substring(0, 100),
  });

  // Look for Discord user ID in various formats:
  // - "Discord: 123456789012345678"
  // - "discord 123456789012345678"
  // - "Discord ID: 123456789012345678"
  // - Just the ID: "123456789012345678"
  const patterns = [
    /discord[:\s]*(\d{17,19})/i,
    /discord\s*id[:\s]*(\d{17,19})/i,
    /^(\d{17,19})$/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = message.match(pattern);
    logger.debug(`🔍 Pattern ${i + 1} (${pattern}):`, {
      matched: !!match,
      result: match ? match[1] : null,
    });
    if (match && match[1]) {
      logger.debug("✅ Discord ID extracted from message:", match[1]);
      return match[1];
    }
  }

  logger.debug("❌ No Discord ID found in message");
  return null;
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

    // If you have an email -> Discord ID mapping, check it here
    // Example: Store email mappings when users link their email via a command
    const storage = await getStorageManager();
    const emailMappings = (await storage.get("email_discord_mappings")) || {};
    const emailKey = email.toLowerCase();

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

/**
 * Map Buy Me a Coffee membership tier to Core tier
 * @param {number} amount - Subscription amount
 * @param {string} membershipTier - BMC membership tier name
 * @returns {string} Core tier name
 */
function mapMembershipTierToCoreTier(amount, membershipTier) {
  logger.debug("🔍 mapMembershipTierToCoreTier:", {
    amount,
    membershipTier,
  });

  // Map based on amount (most reliable)
  if (amount >= 50) {
    logger.debug("✅ Mapped to Core Elite (amount >= $50)");
    return "Core Elite";
  }
  if (amount >= 25) {
    logger.debug("✅ Mapped to Core Premium (amount >= $25)");
    return "Core Premium";
  }
  if (amount >= 10) {
    logger.debug("✅ Mapped to Core Basic (amount >= $10)");
    return "Core Basic";
  }

  // Fallback: Try to match tier name
  const tierName = (membershipTier || "").toLowerCase();
  logger.debug("🔍 Trying tier name matching:", { tierName });

  if (tierName.includes("elite")) {
    logger.debug("✅ Mapped to Core Elite (tier name match)");
    return "Core Elite";
  }
  if (tierName.includes("premium")) {
    logger.debug("✅ Mapped to Core Premium (tier name match)");
    return "Core Premium";
  }
  if (tierName.includes("basic")) {
    logger.debug("✅ Mapped to Core Basic (tier name match)");
    return "Core Basic";
  }

  // Default to Basic for amounts < $10
  logger.debug(
    "⚠️ Defaulting to Core Basic (amount < $10, no tier name match)",
  );
  return "Core Basic";
}
