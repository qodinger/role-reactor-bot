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

    // ===== STEP 1.5: HANDLE KO-FI VERIFICATION =====
    // Ko-fi sends verification requests that must be handled
    const userAgent = req.headers["user-agent"] || "";
    if (userAgent.startsWith("Ko-fi")) {
      logger.info("🔍 Ko-fi verification request received");
      return res.status(200).send("OK");
    }

    // ===== STEP 2: EXTRACT AND VALIDATE DATA =====
    const contentType = req.headers["content-type"];
    logger.info(`📥 Received content type: ${contentType}`);

    // Handle both JSON and form-urlencoded content types
    if (contentType && contentType.includes("application/json")) {
      // Direct JSON (newer Ko-fi format)
      webhookData = req.body;
      logger.info("📋 Processing direct JSON webhook data");
    } else if (
      contentType &&
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      // Form-urlencoded with data field (legacy format)
      const { data } = req.body;
      if (!data) {
        logger.warn(
          "❌ No data field in form-urlencoded Ko-fi webhook request",
        );
        return res.status(400).send("Bad Request: No data field");
      }

      try {
        webhookData = JSON.parse(data);
        logger.info("📋 Processing form-urlencoded webhook data");
      } catch (parseError) {
        logger.error("❌ Failed to parse webhook data as JSON:", parseError);
        return res.status(400).send("Bad Request: Invalid JSON data");
      }
    } else {
      logger.warn(`❌ Unsupported content type: ${contentType}`);
      return res.status(400).send("Bad Request: Unsupported content type");
    }

    // Validate required fields
    if (!webhookData.type) {
      logger.warn("❌ Missing required field: type");
      return res.status(400).send("Bad Request: Missing type field");
    }

    // ===== STEP 3: VERIFY WEBHOOK AUTHENTICATION =====
    // Ko-fi webhook authentication (if configured)
    if (process.env.KOFI_WEBHOOK_TOKEN) {
      // Check for verification_token in webhook data (legacy format)
      if (webhookData.verification_token) {
        const providedToken = webhookData.verification_token;
        const expectedToken = process.env.KOFI_WEBHOOK_TOKEN;

        // Allow known test tokens ONLY in development mode (security fix for production)
        const isDevelopment = process.env.NODE_ENV === "development";
        const testTokens = [
          "zapier-webhook-token",
          "test-webhook-token",
          "webhook-test",
        ];

        const isTestToken =
          isDevelopment && testTokens.includes(providedToken.toLowerCase());
        const isValidToken = providedToken === expectedToken;

        if (!isValidToken && !isTestToken) {
          logger.warn("❌ Invalid Ko-fi webhook token received", {
            providedToken: `${providedToken.substring(0, 10)}...`,
            expectedLength: expectedToken.length,
            providedLength: providedToken.length,
            environment: process.env.NODE_ENV || "production",
          });
          return res.status(401).send("Unauthorized: Invalid token");
        }

        if (isTestToken) {
          logger.info(
            "🧪 Test webhook token detected - allowing for testing purposes (development mode only)",
          );
        } else {
          logger.info("✅ Ko-fi webhook token verified successfully");
        }
      } else {
        // For newer Ko-fi format, we might need to implement different auth
        // For now, log that no token was provided but continue processing
        logger.info(
          "ℹ️ No verification token in webhook data - continuing processing",
        );
      }
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
    // IMPORTANT: Ko-fi webhook limitations
    // Ko-fi only sends webhooks for payment events, NOT for subscription cancellations, pauses, or resumes
    // See: https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook
    // Subscription cancellations must be detected via periodic cleanup (checkExpiredSubscriptions)
    const validWebhookTypes = [
      "Donation",
      "Subscription",
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
    // Ko-fi requires HTTP 200 response within 5 seconds
    // (processingTime already declared above; do not redeclare)
    logger.info(`⏱️ Webhook processing completed in ${processingTime}ms`);

    if (processingResult.success) {
      logger.info("✅ Webhook processed successfully - sending 200 OK");
      res.status(200).send("OK");
    } else {
      logger.error("❌ Webhook processing failed - sending 500 error");
      res.status(500).send("Error processing webhook");
    }
  } catch (error) {
    const errorProcessingTime = Date.now() - startTime;
    logger.error("💥 Critical Error in Ko-fi webhook processing:", {
      error: error.message,
      stack: error.stack,
      webhookData: webhookData
        ? JSON.stringify(webhookData, null, 2)
        : "No data parsed",
      processingTime: `${errorProcessingTime}ms`,
      processedAt: new Date().toISOString(),
    });

    // Ko-fi requires a response within 5 seconds, so send error response quickly
    if (errorProcessingTime < 5000) {
      res.status(500).send("Error processing webhook");
    } else {
      // If we're taking too long, just send 200 to avoid Ko-fi retries
      logger.warn(
        "⚠️ Webhook processing took too long - sending 200 to avoid retries",
      );
      res.status(200).send("OK");
    }
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

    // ===== CALCULATE CORES =====
    const corePricing = config.corePricing;
    const cores = Math.floor(donationAmount * corePricing.donation.rate);

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
      `💳 Donation processing: $${donationAmount} = ${cores} Cores (${corePricing.donation.rate} Cores per $1)`,
    );

    // ===== UPDATE USER CORES =====
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
        // New fields for subscription-based Core system
        subscriptionCredits: 0, // Cores from monthly subscription allowance
        bonusCredits: 0, // Cores from donations (preserved during reset)
        username: discordUsername || fromName || null, // Discord username if available
      };
    }

    const userData = coreCredits[userIdForProcessing];

    // Update username if we have a newer one (don't overwrite with null)
    if (discordUsername && discordUsername !== userData.username) {
      userData.username = discordUsername;
    } else if (!userData.username && fromName) {
      // Fallback to fromName if username is not set
      userData.username = fromName;
    }

    // Ensure credits is a number
    if (userData.credits === null || userData.credits === undefined) {
      userData.credits = 0;
    }

    // ===== DONATION CORE LOGIC =====
    // Handle Cores based on user's subscription status
    // Only donations and subscriptions are supported (shop orders removed)
    if (userData.koFiSubscription?.isActive) {
      // Subscription user: Add as bonus Cores (preserved during monthly reset)
      userData.bonusCredits = (userData.bonusCredits || 0) + cores;
      userData.credits += cores;
      userData.totalGenerated += cores;
      logger.info(
        `💎 Subscription user donation: Added ${cores} bonus Cores (total bonus: ${userData.bonusCredits}, total Cores: ${userData.credits})`,
      );
    } else {
      // Free user: Add Cores normally (no monthly reset)
      userData.credits += cores;
      userData.totalGenerated += cores;
      logger.info(
        `🆓 Free user donation: Added ${cores} Cores (total: ${userData.credits})`,
      );
    }

    userData.lastUpdated = new Date().toISOString();

    // Track donation with enhanced data
    userData.koFiDonations = userData.koFiDonations || [];
    userData.koFiDonations.push({
      amount: donationAmount,
      credits: cores,
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
      `✅ Added ${cores} Cores to user ${userIdForProcessing} (${discordUsername || fromName}) from donation of $${donationAmount}`,
    );

    // ===== SEND CONFIRMATION =====
    if (!isTestMode) {
      await sendDonationConfirmation(
        userIdForProcessing,
        cores,
        donationAmount,
      );
    } else {
      logger.info(
        `🧪 Test mode: Skipping DM confirmation for test user ${userIdForProcessing}`,
      );
    }

    return {
      success: true,
      message: `Successfully processed donation: $${donationAmount} = ${cores} Cores`,
      credits: cores,
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

    // ===== DUPLICATE PROCESSING PROTECTION =====
    // Check if this transaction has already been processed
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    if (
      coreCredits[
        userIdForProcessing
      ]?.koFiSubscription?.processedTransactions?.includes(kofiTransactionId)
    ) {
      logger.warn(
        `⚠️ Duplicate subscription transaction detected: ${kofiTransactionId} for user ${userIdForProcessing}`,
      );
      return {
        success: true,
        message:
          "Subscription already processed (duplicate transaction ignored)",
        credits: coreCredits[userIdForProcessing]?.credits || 0,
      };
    }

    if (isTestMode) {
      logger.info(
        `🧪 Test mode detected for subscription from ${fromName} - using test user ID: ${userIdForProcessing}`,
      );
    }

    // Core status is stored globally, so no need to check specific guilds
    // The bot just needs to be running to process webhooks
    // (Storage already initialized in duplicate protection section above)

    // Initialize user data if it doesn't exist (global, not per guild)
    if (!coreCredits[userIdForProcessing]) {
      coreCredits[userIdForProcessing] = {
        credits: 0,
        isCore: false,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
        koFiSubscription: null,
        // New fields for subscription-based Core system
        subscriptionCredits: 0, // Cores from monthly subscription allowance
        bonusCredits: 0, // Cores from donations (preserved during reset)
        username: discordUsername || fromName || null, // Discord username if available
      };
    }

    const userData = coreCredits[userIdForProcessing];

    // Update username if we have a newer one (don't overwrite with null)
    if (discordUsername && discordUsername !== userData.username) {
      userData.username = discordUsername;
    } else if (!userData.username && fromName) {
      // Fallback to fromName if username is not set
      userData.username = fromName;
    }

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
      } else if (subscriptionAmount >= 5) {
        detectedTier = "Bronze";
        detectionMethod =
          "Amount-based ($5+) - Test Tier (INTERNAL TESTING ONLY)";
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

    // ===== SUBSCRIPTION CORE LOGIC =====
    // For subscriptions, we need to handle Cores differently:
    // - First payment: Set Cores to monthly amount
    // - Subsequent payments: Reset to monthly allowance + preserve bonus Cores
    // - Bonus Cores come from donations and are preserved (shop orders removed)

    if (isFirstSubscriptionPayment) {
      // First subscription payment: Set Cores to monthly amount
      userData.credits = monthlyCredits;
      userData.subscriptionCredits = monthlyCredits; // Track subscription allowance
      userData.bonusCredits = 0; // Track bonus Cores from donations/shop
      logger.info(
        `🎉 First subscription payment: Set Cores to ${monthlyCredits} (monthly allowance)`,
      );
    } else {
      // Subsequent subscription payments: Reset subscription allowance, preserve bonus Cores
      const bonusCredits = userData.bonusCredits || 0; // Preserve bonus Cores
      userData.credits = monthlyCredits + bonusCredits;
      userData.subscriptionCredits = monthlyCredits; // Reset subscription allowance
      // userData.bonusCredits remains the same (preserved)
      logger.info(
        `🔄 Monthly subscription renewal: Reset subscription allowance to ${monthlyCredits}, preserved ${bonusCredits} bonus Cores (total: ${userData.credits})`,
      );
    }

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
      // Add tracking to prevent duplicate processing
      processedTransactions:
        userData.koFiSubscription?.processedTransactions || [],
      monthlyCredits,
      subscriptionStartDate: isFirstSubscriptionPayment
        ? new Date().toISOString()
        : userData.koFiSubscription?.subscriptionStartDate ||
          new Date().toISOString(),
    };

    // Track this transaction to prevent duplicate processing
    if (
      !userData.koFiSubscription.processedTransactions.includes(
        kofiTransactionId,
      )
    ) {
      userData.koFiSubscription.processedTransactions.push(kofiTransactionId);
    }

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

      // ===== REFUND CREDIT LOGIC =====
      // For refunds, we need to handle the deduction order properly
      // Remove from bonus credits first (donation credits), then subscription credits
      const userData = coreCredits[finalDiscordUserId];
      let remainingToRemove = creditsToRemove;
      let bonusRemoved = 0;
      let subscriptionRemoved = 0;

      // Step 1: Remove from bonus credits first (donation credits)
      if (userData.bonusCredits && userData.bonusCredits > 0) {
        bonusRemoved = Math.min(remainingToRemove, userData.bonusCredits);
        userData.bonusCredits -= bonusRemoved;
        remainingToRemove -= bonusRemoved;
      }

      // Step 2: Remove from subscription credits if still needed
      if (
        remainingToRemove > 0 &&
        userData.subscriptionCredits &&
        userData.subscriptionCredits > 0
      ) {
        subscriptionRemoved = Math.min(
          remainingToRemove,
          userData.subscriptionCredits,
        );
        userData.subscriptionCredits -= subscriptionRemoved;
        remainingToRemove -= subscriptionRemoved;
      }

      // Step 3: Update total credits (don't go below 0)
      userData.credits = Math.max(0, userData.credits - creditsToRemove);
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
        `💸 Processed refund: $${refundAmount} = -${creditsToRemove} Cores for user ${finalDiscordUserId}. ` +
          `Removal: ${bonusRemoved} from bonus, ${subscriptionRemoved} from subscription. ` +
          `Remaining: ${userData.credits} total (${userData.subscriptionCredits} subscription, ${userData.bonusCredits} bonus)`,
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
 *
 * IMPORTANT: This is the ONLY way to detect subscription cancellations!
 * Ko-fi does NOT send webhook notifications for subscription cancellations, pauses, or resumes.
 *
 * This function should be called periodically (recommended: every 24 hours) to:
 * 1. Clean up subscriptions marked as inactive
 * 2. Detect expired subscriptions (no payment for 7+ days)
 * 3. Remove Core status from users with cancelled subscriptions
 *
 * @returns {Promise<number>} Number of expired subscriptions cleaned up
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
        // Check if subscription hasn't been processed in over 7 days (grace period)
        // Reduced from 35 days to 7 days for more responsive cancellation detection
        else if (subscription.lastProcessed) {
          const lastProcessed = new Date(subscription.lastProcessed);
          const daysSinceLastProcessed =
            (now - lastProcessed) / (1000 * 60 * 60 * 24);

          if (daysSinceLastProcessed > 7) {
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
