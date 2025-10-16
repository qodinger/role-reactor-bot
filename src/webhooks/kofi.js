import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { config } from "../config/config.js";

const logger = getLogger();

export async function handleKoFiWebhook(req, res) {
  const startTime = Date.now();
  let webhookData = null;
  let processedType = "Unknown";
  let processingResult = { success: false, error: null };

  try {
    // ===== STEP 1: VALIDATE REQUEST =====
    logger.info("🔔 Ko-fi Webhook Received - Starting Processing");

    // Validate request method
    if (req.method !== "POST") {
      logger.warn(`Invalid request method: ${req.method}`);
      return res.status(405).send("Method Not Allowed");
    }

    // Validate content type
    const contentType = req.headers["content-type"];
    if (
      !contentType ||
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      logger.warn(`Invalid content type: ${contentType}`);
      return res.status(400).send("Bad Request: Invalid content type");
    }

    // ===== STEP 2: EXTRACT AND VALIDATE DATA =====
    const { data } = req.body;

    if (!data) {
      logger.warn("❌ No data field in Ko-fi webhook request");
      return res.status(400).send("Bad Request: No data field");
    }

    // Parse the JSON data string with error handling
    try {
      webhookData = JSON.parse(data);
    } catch (parseError) {
      logger.error("❌ Failed to parse webhook data as JSON:", parseError);
      return res.status(400).send("Bad Request: Invalid JSON data");
    }

    // Validate required fields
    if (!webhookData.type) {
      logger.warn("❌ Missing required field: type");
      return res.status(400).send("Bad Request: Missing type field");
    }

    // ===== STEP 3: VERIFY WEBHOOK AUTHENTICATION =====
    if (process.env.KOFI_WEBHOOK_TOKEN) {
      if (webhookData.verification_token !== process.env.KOFI_WEBHOOK_TOKEN) {
        logger.warn("❌ Invalid Ko-fi webhook token received");
        return res.status(401).send("Unauthorized: Invalid token");
      }
      logger.info("✅ Ko-fi webhook token verified successfully");
    } else {
      logger.warn("⚠️ No webhook token configured - accepting all requests");
    }

    // ===== STEP 4: COMPREHENSIVE DATA LOGGING =====
    logger.info("📋 Full Webhook Data:", JSON.stringify(webhookData, null, 2));

    // Enhanced logging with all available fields
    logger.info("🔍 Webhook Analysis:", {
      // Basic identification
      type: webhookData.type,
      messageId: webhookData.message_id,
      timestamp: webhookData.timestamp,

      // User information
      fromName: webhookData.from_name,
      email: webhookData.email,
      isPublic: webhookData.is_public,

      // Discord integration
      discordUserId: webhookData.discord_userid,
      discordUsername: webhookData.discord_username,

      // Financial information
      amount: webhookData.amount,
      currency: webhookData.currency,

      // Transaction details
      kofiTransactionId: webhookData.kofi_transaction_id,
      url: webhookData.url,

      // Subscription specific
      tierName: webhookData.tier_name,
      isSubscriptionPayment: webhookData.is_subscription_payment,
      isFirstSubscriptionPayment: webhookData.is_first_subscription_payment,

      // Shop order specific
      shopItems: webhookData.shop_items,

      // Message content
      message: webhookData.message,

      // Security
      verificationToken: webhookData.verification_token
        ? "***REDACTED***"
        : "Not provided",

      // Additional fields that might be present
      rawData:
        Object.keys(webhookData).length > 20
          ? `${Object.keys(webhookData).length} total fields`
          : "Standard fields only",
    });

    // ===== STEP 5: PROCESS WEBHOOK BASED ON TYPE =====
    const validWebhookTypes = [
      "Donation",
      "Subscription",
      "Shop Order",
      "Subscription Cancelled",
      "Subscription Paused",
      "Subscription Resumed",
      "Refund",
      "Commission",
      "Poll",
      "Goal",
      "Update",
    ];

    if (!validWebhookTypes.includes(webhookData.type)) {
      logger.warn(`⚠️ Unhandled webhook type: ${webhookData.type}`);
      processedType = `Unhandled (${webhookData.type})`;
      processingResult = {
        success: true,
        error: null,
        message: "Unhandled webhook type - logged for review",
      };
    } else {
      // Process based on webhook type
      switch (webhookData.type) {
        case "Donation":
          processingResult = await processDonation(webhookData);
          processedType = "Donation";
          break;
        case "Subscription":
          processingResult = await processSubscription(webhookData);
          processedType = "Subscription";
          break;
        case "Shop Order":
          processingResult = await processShopOrder(webhookData);
          processedType = "Shop Order";
          break;
        case "Subscription Cancelled":
          processingResult = await processSubscriptionCancellation(webhookData);
          processedType = "Subscription Cancellation";
          break;
        case "Subscription Paused":
          processingResult = await processSubscriptionPaused(webhookData);
          processedType = "Subscription Paused";
          break;
        case "Subscription Resumed":
          processingResult = await processSubscriptionResumed(webhookData);
          processedType = "Subscription Resumed";
          break;
        case "Refund":
          processingResult = await processRefund(webhookData);
          processedType = "Refund";
          break;
        case "Commission":
          processingResult = await processCommission(webhookData);
          processedType = "Commission";
          break;
        case "Poll":
          processingResult = await processPoll(webhookData);
          processedType = "Poll";
          break;
        case "Goal":
          processingResult = await processGoal(webhookData);
          processedType = "Goal";
          break;
        case "Update":
          processingResult = await processUpdate(webhookData);
          processedType = "Update";
          break;
        default:
          logger.warn(
            `⚠️ Unexpected webhook type in switch: ${webhookData.type}`,
          );
          processedType = `Unexpected (${webhookData.type})`;
          processingResult = {
            success: true,
            error: null,
            message: "Unexpected webhook type",
          };
      }
    }

    // ===== STEP 6: LOG PROCESSING RESULTS =====
    const processingTime = Date.now() - startTime;

    if (processingResult.success) {
      logger.info("✅ Webhook Processing Complete:", {
        type: processedType,
        fromName: webhookData.from_name,
        amount: webhookData.amount,
        discordUserId: webhookData.discord_userid,
        discordUsername: webhookData.discord_username,
        processingTime: `${processingTime}ms`,
        processedAt: new Date().toISOString(),
        result: processingResult.message || "Successfully processed",
      });
    } else {
      logger.error("❌ Webhook Processing Failed:", {
        type: processedType,
        fromName: webhookData.from_name,
        amount: webhookData.amount,
        discordUserId: webhookData.discord_userid,
        discordUsername: webhookData.discord_username,
        processingTime: `${processingTime}ms`,
        processedAt: new Date().toISOString(),
        error: processingResult.error,
      });
    }

    // ===== STEP 7: SEND RESPONSE =====
    if (processingResult.success) {
      res.status(200).send("OK");
    } else {
      res.status(500).send("Error processing webhook");
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("💥 Critical Error in Ko-fi webhook processing:", {
      error: error.message,
      stack: error.stack,
      webhookData: webhookData
        ? JSON.stringify(webhookData, null, 2)
        : "No data parsed",
      processingTime: `${processingTime}ms`,
      processedAt: new Date().toISOString(),
    });

    res.status(500).send("Error processing webhook");
  }
}

async function processDonation(data) {
  try {
    logger.info("💰 Processing Donation Webhook:");
    logger.info("📊 Donation Data:", JSON.stringify(data, null, 2));

    // ===== VALIDATE REQUIRED FIELDS =====
    if (!data.amount) {
      logger.warn("❌ Missing amount in donation data");
      return { success: false, error: "Missing amount field" };
    }

    if (!data.from_name) {
      logger.warn("❌ Missing from_name in donation data");
      return { success: false, error: "Missing from_name field" };
    }

    // ===== LOG DONATION DETAILS =====
    logger.info("💳 Donation Details:", {
      amount: data.amount,
      currency: data.currency || "USD",
      fromName: data.from_name,
      message: data.message,
      isPublic: data.is_public,
      timestamp: data.timestamp,
      kofiTransactionId: data.kofi_transaction_id,
      url: data.url,
      discordUserId: data.discord_userid,
      discordUsername: data.discord_username,
      email: data.email,
    });

    // ===== EXTRACT AND VALIDATE DATA =====
    const {
      amount,
      message,
      from_name: fromName,
      timestamp,
      url,
      is_public: isPublic,
      discord_userid: discordUserId,
      discord_username: discordUsername,
      email,
      kofi_transaction_id: kofiTransactionId,
    } = data;

    // ===== VALIDATE AMOUNT =====
    const donationAmount = parseFloat(amount);
    if (isNaN(donationAmount) || donationAmount <= 0) {
      logger.warn(`❌ Invalid donation amount: ${amount}`);
      return { success: false, error: "Invalid donation amount" };
    }

    // ===== CHECK PRIVACY SETTINGS =====
    if (!isPublic) {
      logger.info(`🔒 Skipping private donation from ${fromName}`);
      return { success: true, message: "Private donation skipped" };
    }

    // ===== RESOLVE DISCORD USER ID =====
    const finalDiscordUserId = discordUserId || extractDiscordUserId(message);
    logger.info(
      `🔍 Discord User ID: ${finalDiscordUserId} (from webhook: ${discordUserId}, from message: ${extractDiscordUserId(message)})`,
    );

    // Allow test mode for Ko-fi testing (when no real Discord user ID is provided)
    const isTestMode =
      !finalDiscordUserId &&
      (fromName === "Jo Example" ||
        fromName === "Test User" ||
        message?.includes("test"));

    if (!finalDiscordUserId && !isTestMode) {
      logger.warn(
        `❌ No Discord user ID found for donation from ${fromName}. Message: ${message}`,
      );
      return { success: false, error: "No Discord user ID found" };
    }

    // Use test user ID for Ko-fi testing
    const userIdForProcessing = finalDiscordUserId || "test-user-12345";

    if (isTestMode) {
      logger.info(
        `🧪 Test mode detected for donation from ${fromName} - using test user ID: ${userIdForProcessing}`,
      );
    }

    // ===== CALCULATE CREDITS =====
    const corePricing = config.corePricing;
    const credits = Math.floor(donationAmount * corePricing.donation.rate);

    // Validate minimum donation
    if (donationAmount < corePricing.donation.minimum) {
      logger.warn(
        `❌ Donation below minimum: $${donationAmount} < $${corePricing.donation.minimum}`,
      );

      // Send user-friendly message about minimum donation
      await sendMinimumDonationMessage(
        finalDiscordUserId,
        donationAmount,
        corePricing.donation.minimum,
      );

      return {
        success: false,
        error: `Donation below minimum amount ($${donationAmount} < $${corePricing.donation.minimum})`,
        userNotified: true,
      };
    }

    logger.info(
      `💳 Donation processing: $${donationAmount} = ${credits} Cores (${corePricing.donation.rate} Cores per $1)`,
    );

    // ===== UPDATE USER CREDITS =====
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Initialize user data if it doesn't exist
    if (!coreCredits[userIdForProcessing]) {
      coreCredits[userIdForProcessing] = {
        credits: 0,
        isCore: false,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        koFiDonations: [],
      };
    }

    const userData = coreCredits[userIdForProcessing];

    // Ensure credits is a number
    if (userData.credits === null || userData.credits === undefined) {
      userData.credits = 0;
    }

    // Add credits
    userData.credits += credits;
    userData.totalGenerated += credits;
    userData.lastUpdated = new Date().toISOString();

    // Track donation with enhanced data
    userData.koFiDonations = userData.koFiDonations || [];
    userData.koFiDonations.push({
      amount: donationAmount,
      credits,
      fromName,
      discordUsername,
      email,
      timestamp,
      url,
      kofiTransactionId,
      processed: true,
      processedAt: new Date().toISOString(),
    });

    // Save centralized credit data
    await storage.set("core_credit", coreCredits);

    logger.info(
      `✅ Added ${credits} credits to user ${userIdForProcessing} (${discordUsername || fromName}) from donation of $${donationAmount}`,
    );

    // ===== SEND CONFIRMATION =====
    if (!isTestMode) {
      await sendDonationConfirmation(
        userIdForProcessing,
        credits,
        donationAmount,
      );
    } else {
      logger.info(
        `🧪 Test mode: Skipping DM confirmation for test user ${userIdForProcessing}`,
      );
    }

    return {
      success: true,
      message: `Successfully processed donation: $${donationAmount} = ${credits} Cores`,
      credits,
      amount: donationAmount,
    };
  } catch (error) {
    logger.error("❌ Error processing donation:", error);
    return { success: false, error: error.message };
  }
}

async function processSubscription(data) {
  try {
    // Log subscription-specific details
    logger.info("🔄 Processing Subscription Webhook:");
    logger.info("📊 Subscription Data:", JSON.stringify(data, null, 2));

    logger.info("💎 Subscription Details:", {
      fromName: data.from_name,
      email: data.email,
      tierName: data.tier_name,
      isSubscriptionPayment: data.is_subscription_payment,
      isFirstSubscriptionPayment: data.is_first_subscription_payment,
      amount: data.amount,
      currency: data.currency || "USD",
      discordUserId: data.discord_userid,
      discordUsername: data.discord_username,
      url: data.url,
      kofiTransactionId: data.kofi_transaction_id,
      isPublic: data.is_public,
      timestamp: data.timestamp,
    });

    const {
      from_name: fromName,
      email,
      tier_name: tierName,
      is_subscription_payment: isSubscriptionPayment,
      is_first_subscription_payment: isFirstSubscriptionPayment,
      amount,
      discord_userid: discordUserId,
      discord_username: discordUsername,
      url,
      kofi_transaction_id: kofiTransactionId,
      is_public: isPublic,
    } = data;

    // Check if subscription is public (respect privacy settings)
    if (!isPublic) {
      logger.info(`Skipping private subscription from ${fromName}`);
      return { success: true, message: "Private subscription skipped" };
    }

    // Use Discord user ID from webhook if available, otherwise find by email
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(email));

    // Allow test mode for Ko-fi testing (when no real Discord user ID is provided)
    const isTestMode =
      !finalDiscordUserId &&
      (fromName === "Jo Example" ||
        fromName === "Test User" ||
        email?.includes("example.com"));

    if (!finalDiscordUserId && !isTestMode) {
      logger.warn(
        `Could not find Discord user for subscription from ${fromName} (${email})`,
      );
      return { success: false, error: "Discord user not found" };
    }

    // Use test user ID for Ko-fi testing
    const userIdForProcessing = finalDiscordUserId || "test-user-12345";

    if (isTestMode) {
      logger.info(
        `🧪 Test mode detected for subscription from ${fromName} - using test user ID: ${userIdForProcessing}`,
      );
    }

    // Core status is stored globally, so no need to check specific guilds
    // The bot just needs to be running to process webhooks

    // Get centralized credit data
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Initialize user data if it doesn't exist (global, not per guild)
    if (!coreCredits[userIdForProcessing]) {
      coreCredits[userIdForProcessing] = {
        credits: 0,
        isCore: false,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        koFiSubscription: null,
      };
    }

    const userData = coreCredits[userIdForProcessing];

    // Ensure credits is a number, not null
    if (userData.credits === null || userData.credits === undefined) {
      userData.credits = 0;
    }

    // Set Core status (for both first-time and recurring payments)
    userData.isCore = true;
    userData.lastUpdated = new Date().toISOString();

    // Calculate monthly credits based on config tier system
    const subscriptionAmount = parseFloat(amount);
    const corePricing = config.corePricing;

    // Determine Core tier based on Ko-fi tier name or subscription amount
    let detectedTier = null;
    let detectionMethod = "";

    // First, try to use Ko-fi tier name directly (if it matches our Core tiers)
    const validTierNames = Object.keys(corePricing.subscriptions);
    if (tierName && validTierNames.includes(tierName)) {
      detectedTier = tierName;
      detectionMethod = "Ko-fi tier name (exact match)";
    }

    // If no exact tier name match, fall back to amount-based detection
    if (!detectedTier) {
      if (subscriptionAmount >= 50) {
        detectedTier = "Core Elite";
        detectionMethod = "Amount-based ($50+)";
      } else if (subscriptionAmount >= 25) {
        detectedTier = "Core Premium";
        detectionMethod = "Amount-based ($25+)";
      } else if (subscriptionAmount >= 10) {
        detectedTier = "Core Basic";
        detectionMethod = "Amount-based ($10+)";
      }
    }

    // Check for tier changes and handle appropriately
    const previousTier = userData.coreTier;
    const tierChanged = previousTier && previousTier !== detectedTier;

    if (detectedTier) {
      userData.coreTier = detectedTier;

      if (tierChanged) {
        logger.info(
          `🔄 TIER CHANGE: ${previousTier} → ${detectedTier} for $${subscriptionAmount} subscription (${detectionMethod})`,
        );
      } else {
        logger.info(
          `🎯 Detected Core tier: ${detectedTier} for $${subscriptionAmount} subscription (${detectionMethod})`,
        );
      }
    }

    // Get tier-based Core rewards from config
    const tierCoreMapping = {};
    Object.entries(corePricing.subscriptions).forEach(
      ([tierName, tierData]) => {
        tierCoreMapping[tierName] = tierData.cores;
      },
    );

    // Use detected tier for credit calculation
    const monthlyCredits = detectedTier
      ? tierCoreMapping[detectedTier] || 0
      : 0;

    // Reject subscriptions under minimum
    if (monthlyCredits === 0) {
      logger.warn(
        `❌ Subscription rejected: ${userIdForProcessing} (${discordUsername || fromName}) - Amount $${subscriptionAmount} below $${corePricing.coreSystem.minimumSubscription} minimum`,
      );
      return { success: false, error: "Subscription amount below minimum" };
    }

    // Add monthly credits (scaled based on subscription amount + bonus)
    userData.credits += monthlyCredits;

    // Track subscription with enhanced data
    userData.koFiSubscription = {
      fromName,
      email,
      tierName: tierName || "Monthly Coffee",
      detectedTier,
      detectionMethod,
      isSubscriptionPayment,
      isFirstSubscriptionPayment,
      amount: parseFloat(amount),
      discordUsername,
      kofiTransactionId,
      url,
      lastProcessed: new Date().toISOString(),
      isActive: true,
      subscriptionType: "monthly_coffee",
    };

    // Save centralized credit data
    await storage.set("core_credit", coreCredits);

    if (isFirstSubscriptionPayment) {
      logger.info(
        `🎉 NEW Core member: ${userIdForProcessing} (${discordUsername || fromName}) - ${tierName || "Core"} subscription started! ($${subscriptionAmount}/month = ${monthlyCredits} Cores monthly)`,
      );
    } else if (tierChanged) {
      logger.info(
        `🔄 TIER CHANGE COMPLETE: ${userIdForProcessing} (${discordUsername || fromName}) upgraded from ${previousTier} to ${detectedTier} - Added ${monthlyCredits} Cores ($${subscriptionAmount}/month)`,
      );
    } else {
      logger.info(
        `💰 Monthly Core credits: Added ${monthlyCredits} Cores to ${userIdForProcessing} (${discordUsername || fromName}) from ${tierName || "Core"} subscription ($${subscriptionAmount}/month)`,
      );
    }

    // Send confirmation DM to user
    if (!isTestMode) {
      await sendSubscriptionConfirmation(
        userIdForProcessing,
        tierName,
        isFirstSubscriptionPayment,
        subscriptionAmount,
        monthlyCredits,
        tierChanged,
        previousTier,
        detectedTier,
      );
    } else {
      logger.info(
        `🧪 Test mode: Skipping DM confirmation for test user ${userIdForProcessing}`,
      );
    }

    return {
      success: true,
      message: `Successfully processed subscription: $${subscriptionAmount} = ${monthlyCredits} Cores`,
      credits: monthlyCredits,
      amount: subscriptionAmount,
      tier: detectedTier,
      tierChanged,
    };
  } catch (error) {
    logger.error("❌ Error processing subscription:", error);
    return { success: false, error: error.message };
  }
}

async function processShopOrder(data) {
  try {
    // Log shop order-specific details
    logger.info("🛒 Processing Shop Order Webhook:");
    logger.info("📊 Shop Order Data:", JSON.stringify(data, null, 2));

    logger.info("🛍️ Shop Order Details:", {
      fromName: data.from_name,
      email: data.email,
      amount: data.amount,
      currency: data.currency || "USD",
      discordUserId: data.discord_userid,
      discordUsername: data.discord_username,
      shopItems: data.shop_items,
      url: data.url,
      kofiTransactionId: data.kofi_transaction_id,
      isPublic: data.is_public,
      timestamp: data.timestamp,
    });

    const {
      from_name: fromName,
      email,
      amount,
      discord_userid: discordUserId,
      discord_username: discordUsername,
      shop_items: shopItems,
      url,
      kofi_transaction_id: kofiTransactionId,
      is_public: isPublic,
    } = data;

    // Check if shop order is public (respect privacy settings)
    if (!isPublic) {
      logger.info(`Skipping private shop order from ${fromName}`);
      return { success: true, message: "Private shop order skipped" };
    }

    // Use Discord user ID from webhook if available, otherwise find by email
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(email));

    if (!finalDiscordUserId) {
      logger.warn(
        `Could not find Discord user for shop order from ${fromName} (${email})`,
      );
      return { success: false, error: "Discord user not found" };
    }

    // Calculate credits based on amount (shop orders get credits too) - $0.05 per credit
    const credits = Math.floor(parseFloat(amount) / 0.05);

    // Credits are stored globally, so no need to check specific guilds
    // The bot just needs to be running to process webhooks

    // Get centralized credit data
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Initialize user data if it doesn't exist (global, not per guild)
    if (!coreCredits[finalDiscordUserId]) {
      coreCredits[finalDiscordUserId] = {
        credits: 0,
        isCore: false,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        koFiShopOrders: [],
      };
    }

    const userData = coreCredits[finalDiscordUserId];

    // Ensure credits is a number, not null
    if (userData.credits === null || userData.credits === undefined) {
      userData.credits = 0;
    }

    // Add credits
    userData.credits += credits;
    userData.lastUpdated = new Date().toISOString();

    // Track shop order
    userData.koFiShopOrders = userData.koFiShopOrders || [];
    userData.koFiShopOrders.push({
      amount: parseFloat(amount),
      credits,
      fromName,
      discordUsername,
      email,
      shopItems,
      kofiTransactionId,
      url,
      processed: true,
    });

    // Save centralized credit data
    await storage.set("core_credit", coreCredits);

    logger.info(
      `Added ${credits} credits to user ${finalDiscordUserId} (${discordUsername}) from shop order of $${amount}`,
    );

    // Send confirmation DM to user
    await sendShopOrderConfirmation(finalDiscordUserId, credits, amount);

    return {
      success: true,
      message: `Successfully processed shop order: $${amount} = ${credits} Cores`,
      credits,
      amount: parseFloat(amount),
    };
  } catch (error) {
    logger.error("❌ Error processing shop order:", error);
    return { success: false, error: error.message };
  }
}

async function processSubscriptionCancellation(data) {
  try {
    // Log subscription cancellation details
    logger.info("❌ Processing Subscription Cancellation Webhook:");
    logger.info("📊 Cancellation Data:", JSON.stringify(data, null, 2));

    logger.info("🚫 Cancellation Details:", {
      email: data.email,
      fromName: data.from_name,
      discordUserId: data.discord_userid,
      discordUsername: data.discord_username,
      timestamp: data.timestamp,
      kofiTransactionId: data.kofi_transaction_id,
      url: data.url,
    });

    const {
      email,
      from_name: fromName,
      discord_userid: discordUserId,
      discord_username: discordUsername,
    } = data;

    // Find Discord user by email or use provided Discord ID
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(email));
    if (!finalDiscordUserId) {
      logger.warn(
        `Could not find Discord user for cancelled subscription from ${fromName || email}`,
      );
      return { success: false, error: "Discord user not found" };
    }

    // Core status is stored globally, so no need to check specific guilds
    // The bot just needs to be running to process webhooks

    // Get centralized credit data
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Initialize user data if it doesn't exist (global, not per guild)
    if (!coreCredits[finalDiscordUserId]) {
      coreCredits[finalDiscordUserId] = {
        credits: 0,
        isCore: false,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        koFiSubscription: null,
      };
    }

    const userData = coreCredits[finalDiscordUserId];

    // Ensure credits is a number, not null
    if (userData.credits === null || userData.credits === undefined) {
      userData.credits = 0;
    }

    // Remove Core status and tier (they lose Core membership benefits)
    userData.isCore = false;
    userData.coreTier = null;
    userData.lastUpdated = new Date().toISOString();

    // Update subscription status
    if (userData.koFiSubscription) {
      userData.koFiSubscription.isActive = false;
      userData.koFiSubscription.cancelledAt = new Date().toISOString();
      userData.koFiSubscription.cancelledBy = fromName || "Unknown";
    }

    // Save centralized credit data
    await storage.set("core_credit", coreCredits);

    logger.info(
      `❌ CORE MEMBERSHIP CANCELLED: Removed Core status and tier for user ${finalDiscordUserId} (${discordUsername || fromName}) - Monthly Coffee subscription cancelled`,
    );

    // Send cancellation notification
    await sendSubscriptionCancellationNotification(
      finalDiscordUserId,
      fromName,
    );

    return {
      success: true,
      message: `Successfully cancelled subscription for user ${finalDiscordUserId}`,
      userId: finalDiscordUserId,
    };
  } catch (error) {
    logger.error("❌ Error processing subscription cancellation:", error);
    return { success: false, error: error.message };
  }
}

// Helper functions
function extractDiscordUserId(message) {
  // Look for Discord user ID in message (format: "Discord: 123456789012345678")
  const discordMatch = message.match(/discord[:\s]*(\d{17,19})/i);
  return discordMatch ? discordMatch[1] : null;
}

async function findDiscordUserByEmail(email) {
  // This would require storing email -> Discord ID mapping
  // You could ask users to link their email in a command
  try {
    const storage = await getStorageManager();
    return await storage.get(`email_to_discord_${email}`);
  } catch (error) {
    logger.warn(`Error finding Discord user by email: ${error.message}`);
    return null;
  }
}

async function sendDonationConfirmation(discordUserId, credits, amount) {
  // Send DM to user confirming credit addition
  // Implementation depends on your bot setup
  logger.info(
    `Would send DM to ${discordUserId}: Added ${credits} credits from $${amount} donation`,
  );
}

async function sendSubscriptionConfirmation(
  discordUserId,
  tierName,
  isFirstPayment,
  subscriptionAmount,
  monthlyCredits,
  tierChanged = false,
  previousTier = null,
  detectedTier = null,
) {
  // Send DM to user confirming Core membership
  if (isFirstPayment) {
    logger.info(
      `🎉 Would send DM to ${discordUserId}: Welcome to Core membership! Monthly Coffee subscription activated (${tierName || "Monthly Coffee"}) - $${subscriptionAmount}/month = ${monthlyCredits} Cores monthly`,
    );
  } else if (tierChanged) {
    logger.info(
      `🔄 Would send DM to ${discordUserId}: Tier change confirmed! Upgraded from ${previousTier} to ${detectedTier} - $${subscriptionAmount}/month = ${monthlyCredits} Cores monthly`,
    );
  } else {
    logger.info(
      `💰 Would send DM to ${discordUserId}: Monthly Core credits added! ${monthlyCredits} Cores from your $${subscriptionAmount}/month subscription (includes 50 Cores subscriber bonus!)`,
    );
  }
}

async function sendSubscriptionCancellationNotification(
  discordUserId,
  fromName,
) {
  // Send DM to user about subscription cancellation
  logger.info(
    `❌ Would send DM to ${discordUserId}: Core membership cancelled - Monthly Coffee subscription ended by ${fromName || "user"}`,
  );
}

async function sendShopOrderConfirmation(discordUserId, credits, amount) {
  // Send DM to user confirming shop order credit addition
  logger.info(
    `Would send DM to ${discordUserId}: Added ${credits} credits from $${amount} shop order`,
  );
}

async function sendMinimumDonationMessage(
  discordUserId,
  donationAmount,
  minimumAmount,
) {
  // Send DM to user about minimum donation requirement
  logger.info(
    `📧 Would send DM to ${discordUserId}: Thank you for your $${donationAmount} donation! Unfortunately, we have a minimum donation requirement of $${minimumAmount} to process credits. Please consider donating $${minimumAmount} or more to receive Cores.`,
  );
}

// ===== ADDITIONAL WEBHOOK TYPE HANDLERS =====

async function processSubscriptionPaused(data) {
  try {
    logger.info("⏸️ Processing Subscription Paused Webhook:");
    logger.info("📊 Paused Data:", JSON.stringify(data, null, 2));

    const { from_name: fromName, email, discord_userid: discordUserId } = data;
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(email));

    if (!finalDiscordUserId) {
      logger.warn(
        `Could not find Discord user for paused subscription from ${fromName}`,
      );
      return { success: false, error: "Discord user not found" };
    }

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    if (coreCredits[finalDiscordUserId]?.koFiSubscription) {
      coreCredits[finalDiscordUserId].koFiSubscription.isPaused = true;
      coreCredits[finalDiscordUserId].koFiSubscription.pausedAt =
        new Date().toISOString();
      coreCredits[finalDiscordUserId].lastUpdated = new Date().toISOString();

      await storage.set("core_credit", coreCredits);

      logger.info(
        `⏸️ Subscription paused for user ${finalDiscordUserId} (${fromName})`,
      );
      return { success: true, message: "Subscription paused successfully" };
    }

    return { success: false, error: "No active subscription found" };
  } catch (error) {
    logger.error("❌ Error processing subscription pause:", error);
    return { success: false, error: error.message };
  }
}

async function processSubscriptionResumed(data) {
  try {
    logger.info("▶️ Processing Subscription Resumed Webhook:");
    logger.info("📊 Resumed Data:", JSON.stringify(data, null, 2));

    const { from_name: fromName, email, discord_userid: discordUserId } = data;
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(email));

    if (!finalDiscordUserId) {
      logger.warn(
        `Could not find Discord user for resumed subscription from ${fromName}`,
      );
      return { success: false, error: "Discord user not found" };
    }

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    if (coreCredits[finalDiscordUserId]?.koFiSubscription) {
      coreCredits[finalDiscordUserId].koFiSubscription.isPaused = false;
      coreCredits[finalDiscordUserId].koFiSubscription.resumedAt =
        new Date().toISOString();
      coreCredits[finalDiscordUserId].lastUpdated = new Date().toISOString();

      await storage.set("core_credit", coreCredits);

      logger.info(
        `▶️ Subscription resumed for user ${finalDiscordUserId} (${fromName})`,
      );
      return { success: true, message: "Subscription resumed successfully" };
    }

    return { success: false, error: "No subscription found to resume" };
  } catch (error) {
    logger.error("❌ Error processing subscription resume:", error);
    return { success: false, error: error.message };
  }
}

async function processRefund(data) {
  try {
    logger.info("💸 Processing Refund Webhook:");
    logger.info("📊 Refund Data:", JSON.stringify(data, null, 2));

    const {
      from_name: fromName,
      amount,
      discord_userid: discordUserId,
      kofi_transaction_id: kofiTransactionId,
    } = data;
    const finalDiscordUserId =
      discordUserId || (await findDiscordUserByEmail(data.email));

    if (!finalDiscordUserId) {
      logger.warn(`Could not find Discord user for refund from ${fromName}`);
      return { success: false, error: "Discord user not found" };
    }

    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return { success: false, error: "Invalid refund amount" };
    }

    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    if (coreCredits[finalDiscordUserId]) {
      // Calculate credits to remove (same rate as donation)
      const corePricing = config.corePricing;
      const creditsToRemove = Math.floor(
        refundAmount * corePricing.donation.rate,
      );

      // Remove credits (don't go below 0)
      coreCredits[finalDiscordUserId].credits = Math.max(
        0,
        coreCredits[finalDiscordUserId].credits - creditsToRemove,
      );
      coreCredits[finalDiscordUserId].lastUpdated = new Date().toISOString();

      // Track refund
      coreCredits[finalDiscordUserId].koFiRefunds =
        coreCredits[finalDiscordUserId].koFiRefunds || [];
      coreCredits[finalDiscordUserId].koFiRefunds.push({
        amount: refundAmount,
        creditsRemoved: creditsToRemove,
        fromName,
        kofiTransactionId,
        processedAt: new Date().toISOString(),
      });

      await storage.set("core_credit", coreCredits);

      logger.info(
        `💸 Processed refund: $${refundAmount} = -${creditsToRemove} Cores for user ${finalDiscordUserId}`,
      );
      return {
        success: true,
        message: `Refund processed: $${refundAmount} = -${creditsToRemove} Cores`,
      };
    }

    return { success: false, error: "User not found" };
  } catch (error) {
    logger.error("❌ Error processing refund:", error);
    return { success: false, error: error.message };
  }
}

async function processCommission(data) {
  try {
    logger.info("🎨 Processing Commission Webhook:");
    logger.info("📊 Commission Data:", JSON.stringify(data, null, 2));

    // Commissions might not give credits, just log them
    logger.info(
      `🎨 Commission received from ${data.from_name}: $${data.amount}`,
    );
    return { success: true, message: "Commission logged (no credits awarded)" };
  } catch (error) {
    logger.error("❌ Error processing commission:", error);
    return { success: false, error: error.message };
  }
}

async function processPoll(data) {
  try {
    logger.info("📊 Processing Poll Webhook:");
    logger.info("📊 Poll Data:", JSON.stringify(data, null, 2));

    // Polls don't give credits, just log them
    logger.info(`📊 Poll created: ${data.title || "Untitled"}`);
    return { success: true, message: "Poll logged (no credits awarded)" };
  } catch (error) {
    logger.error("❌ Error processing poll:", error);
    return { success: false, error: error.message };
  }
}

async function processGoal(data) {
  try {
    logger.info("🎯 Processing Goal Webhook:");
    logger.info("📊 Goal Data:", JSON.stringify(data, null, 2));

    // Goals don't give credits, just log them
    logger.info(
      `🎯 Goal update: ${data.title || "Untitled"} - ${data.amount || "Unknown amount"}`,
    );
    return { success: true, message: "Goal logged (no credits awarded)" };
  } catch (error) {
    logger.error("❌ Error processing goal:", error);
    return { success: false, error: error.message };
  }
}

async function processUpdate(data) {
  try {
    logger.info("📝 Processing Update Webhook:");
    logger.info("📊 Update Data:", JSON.stringify(data, null, 2));

    // Updates don't give credits, just log them
    logger.info(`📝 Update posted: ${data.title || "Untitled"}`);
    return { success: true, message: "Update logged (no credits awarded)" };
  } catch (error) {
    logger.error("❌ Error processing update:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for expired subscriptions and remove Core status
 * This should be called periodically to clean up cancelled subscriptions
 */
export async function checkExpiredSubscriptions() {
  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    let expiredCount = 0;
    const now = new Date();

    for (const [userId, userData] of Object.entries(coreCredits)) {
      if (userData.isCore && userData.koFiSubscription) {
        const subscription = userData.koFiSubscription;

        // Check if subscription is marked as inactive
        if (!subscription.isActive) {
          userData.isCore = false;
          userData.lastUpdated = new Date().toISOString();
          expiredCount++;

          logger.info(
            `🧹 Cleaned up expired Core membership for user ${userId} (subscription inactive)`,
          );
        }
        // Check if subscription hasn't been processed in over 35 days (grace period)
        else if (subscription.lastProcessed) {
          const lastProcessed = new Date(subscription.lastProcessed);
          const daysSinceLastProcessed =
            (now - lastProcessed) / (1000 * 60 * 60 * 24);

          if (daysSinceLastProcessed > 35) {
            userData.isCore = false;
            userData.koFiSubscription.isActive = false;
            userData.koFiSubscription.cancelledAt = new Date().toISOString();
            userData.koFiSubscription.cancelledBy = "System (expired)";
            userData.lastUpdated = new Date().toISOString();
            expiredCount++;

            logger.info(
              `⏰ Expired Core membership for user ${userId} - no payment in ${Math.floor(daysSinceLastProcessed)} days`,
            );
          }
        }
      }
    }

    if (expiredCount > 0) {
      await storage.set("core_credit", coreCredits);
      logger.info(`🧹 Cleaned up ${expiredCount} expired Core memberships`);
    }

    return expiredCount;
  } catch (error) {
    logger.error("Error checking expired subscriptions:", error);
    return 0;
  }
}
