import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { config } from "../config/config.js";

const logger = getLogger();

export async function handleKoFiWebhook(req, res) {
  try {
    // Ko-fi sends data as application/x-www-form-urlencoded with 'data' field containing JSON
    const { data } = req.body;

    if (!data) {
      logger.warn("No data field in Ko-fi webhook request");
      return res.status(400).send("Bad Request: No data field");
    }

    // Parse the JSON data string
    const webhookData = JSON.parse(data);

    // Verify the webhook token (if configured)
    if (process.env.KOFI_WEBHOOK_TOKEN) {
      if (webhookData.verification_token !== process.env.KOFI_WEBHOOK_TOKEN) {
        logger.warn("Invalid Ko-fi webhook token received");
        return res.status(401).send("Unauthorized: Invalid token");
      }
      logger.info("Ko-fi webhook token verified successfully");
    }

    // Log the full incoming webhook data for debugging
    logger.info("🔔 Ko-fi Webhook Received:");
    logger.info("📋 Full Webhook Data:", JSON.stringify(webhookData, null, 2));
    logger.info("🔍 Key Information:", {
      type: webhookData.type,
      messageId: webhookData.message_id,
      fromName: webhookData.from_name,
      amount: webhookData.amount,
      isPublic: webhookData.is_public,
      discordUserId: webhookData.discord_userid,
      discordUsername: webhookData.discord_username,
      verificationToken: webhookData.verification_token,
    });

    // Process based on webhook type
    if (webhookData.type === "Donation") {
      await processDonation(webhookData);
    } else if (webhookData.type === "Subscription") {
      await processSubscription(webhookData);
    } else if (webhookData.type === "Shop Order") {
      await processShopOrder(webhookData);
    } else if (webhookData.type === "Subscription Cancelled") {
      await processSubscriptionCancellation(webhookData);
    } else {
      logger.info(`Unhandled webhook type: ${webhookData.type}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    logger.error("Error processing Ko-fi webhook:", error);
    res.status(500).send("Error processing webhook");
  }
}

async function processDonation(data) {
  logger.info("💰 Processing Donation Webhook:");
  logger.info("📊 Donation Data:", JSON.stringify(data, null, 2));

  // Extract information from Ko-fi webhook (using actual API format)
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

  // Check if donation is public (respect privacy settings)
  if (!isPublic) {
    logger.info(`Skipping private donation from ${fromName}`);
    return;
  }

  // Use Discord user ID from webhook if available, otherwise parse from message
  const finalDiscordUserId = discordUserId || extractDiscordUserId(message);
  logger.info(
    `🔍 Discord User ID: ${finalDiscordUserId} (from webhook: ${discordUserId}, from message: ${extractDiscordUserId(message)})`,
  );

  if (!finalDiscordUserId) {
    logger.warn(
      `❌ No Discord user ID found for donation from ${fromName}. Message: ${message}`,
    );
    return;
  }

  // Calculate credits based on config rate
  const donationAmount = parseFloat(amount);
  const corePricing = config.corePricing;
  const credits = Math.floor(donationAmount * corePricing.donation.rate);

  logger.info(
    `💳 Donation processing: $${donationAmount} = ${credits} Cores (${corePricing.donation.rate} Cores per $1)`,
  );

  // Get all guilds where the bot is active
  // This allows any Discord user to get credits, regardless of which server they're in
  const botGuilds = await getAllBotGuilds();
  logger.info(`🏠 Bot active guilds: ${botGuilds.length} guilds found`);

  if (botGuilds.length === 0) {
    logger.warn(`⚠️ No active guilds found. Cannot process donation.`);
    return;
  }

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
      koFiDonations: [],
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

  // Track donation with enhanced data
  userData.koFiDonations = userData.koFiDonations || [];
  userData.koFiDonations.push({
    amount: parseFloat(amount),
    credits,
    fromName,
    discordUsername,
    email,
    timestamp,
    url,
    kofiTransactionId,
    processed: true,
  });

  // Save centralized credit data
  await storage.set("core_credit", coreCredits);

  logger.info(
    `Added ${credits} credits to user ${finalDiscordUserId} (${discordUsername}) from donation of $${amount}`,
  );

  // Send confirmation DM to user (optional)
  await sendDonationConfirmation(finalDiscordUserId, credits, amount);
}

async function processSubscription(data) {
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
    return;
  }

  // Use Discord user ID from webhook if available, otherwise find by email
  const finalDiscordUserId =
    discordUserId || (await findDiscordUserByEmail(email));

  if (!finalDiscordUserId) {
    logger.warn(
      `Could not find Discord user for subscription from ${fromName} (${email})`,
    );
    return;
  }

  // Get all guilds where the bot is active
  // This allows any Discord user to get Core status, regardless of which server they're in
  const botGuilds = await getAllBotGuilds();

  if (botGuilds.length === 0) {
    logger.warn(`No active guilds found. Cannot grant Core membership.`);
    return;
  }

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

  // Set Core status (for both first-time and recurring payments)
  userData.isCore = true;
  userData.lastUpdated = new Date().toISOString();

  // Calculate monthly credits based on config tier system
  const subscriptionAmount = parseFloat(amount);
  const corePricing = config.corePricing;

  // Get tier-based Core rewards from config
  const tierCoreMapping = {};
  Object.entries(corePricing.subscriptions).forEach(([tierName, tierData]) => {
    tierCoreMapping[tierName] = tierData.cores;
  });

  // Use tier-based mapping only (no fallback)
  const monthlyCredits = tierCoreMapping[tierName] || 0;

  // Reject subscriptions under minimum
  if (monthlyCredits === 0) {
    logger.warn(
      `❌ Subscription rejected: ${finalDiscordUserId} (${discordUsername}) - Amount $${subscriptionAmount} below $${corePricing.coreSystem.minimumSubscription} minimum`,
    );
    return;
  }

  // Add monthly credits (scaled based on subscription amount + bonus)
  userData.credits += monthlyCredits;

  // Track subscription with enhanced data
  userData.koFiSubscription = {
    fromName,
    email,
    tierName: tierName || "Monthly Coffee",
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
      `🎉 NEW Core member: ${finalDiscordUserId} (${discordUsername}) - ${tierName || "Core"} subscription started! ($${subscriptionAmount}/month = ${monthlyCredits} Cores monthly)`,
    );
  } else {
    logger.info(
      `💰 Monthly Core credits: Added ${monthlyCredits} Cores to ${finalDiscordUserId} (${discordUsername}) from ${tierName || "Core"} subscription ($${subscriptionAmount}/month)`,
    );
  }

  // Send confirmation DM to user
  await sendSubscriptionConfirmation(
    finalDiscordUserId,
    tierName,
    isFirstSubscriptionPayment,
    subscriptionAmount,
    monthlyCredits,
  );
}

async function processShopOrder(data) {
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
    return;
  }

  // Use Discord user ID from webhook if available, otherwise find by email
  const finalDiscordUserId =
    discordUserId || (await findDiscordUserByEmail(email));

  if (!finalDiscordUserId) {
    logger.warn(
      `Could not find Discord user for shop order from ${fromName} (${email})`,
    );
    return;
  }

  // Calculate credits based on amount (shop orders get credits too) - $0.05 per credit
  const credits = Math.floor(parseFloat(amount) / 0.05);

  // Get all guilds where the bot is active
  // This allows any Discord user to get Core status, regardless of which server they're in
  const botGuilds = await getAllBotGuilds();

  if (botGuilds.length === 0) {
    logger.warn(`No active guilds found. Cannot grant Core membership.`);
    return;
  }

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
}

async function processSubscriptionCancellation(data) {
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
    return;
  }

  // Get all guilds where the bot is active
  // This allows any Discord user to get Core status, regardless of which server they're in
  const botGuilds = await getAllBotGuilds();

  if (botGuilds.length === 0) {
    logger.warn(
      `No active guilds found. Cannot process subscription cancellation.`,
    );
    return;
  }

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

  // Remove Core status (they lose Core membership benefits)
  userData.isCore = false;
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
    `❌ CORE MEMBERSHIP CANCELLED: Removed Core status for user ${finalDiscordUserId} (${discordUsername || fromName}) - Monthly Coffee subscription cancelled`,
  );

  // Send cancellation notification
  await sendSubscriptionCancellationNotification(finalDiscordUserId, fromName);
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

async function getAllBotGuilds() {
  // Get all guilds where the bot is active
  // This allows any Discord user to get credits, regardless of which server they're in
  logger.info(`🔍 Getting all bot guilds...`);

  try {
    const storage = await getStorageManager();

    // Get all guilds from the bot's guild cache or from storage
    // For now, we'll use a simple approach: process credits for all known guilds
    const allGuilds = (await storage.get("bot_active_guilds")) || [];

    if (allGuilds.length === 0) {
      // If no guilds are stored, we'll use a fallback approach
      // In production, you might want to query Discord API for bot's guilds
      logger.info(`📋 No stored guilds found, using fallback approach`);
      return ["default_guild"]; // Fallback for testing
    }

    logger.info(`📋 Found ${allGuilds.length} active guilds:`, allGuilds);
    return allGuilds;
  } catch (error) {
    logger.warn(`⚠️ Error getting bot guilds:`, error.message);
    // Fallback: return a default guild for processing
    return ["default_guild"];
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
) {
  // Send DM to user confirming Core membership
  if (isFirstPayment) {
    logger.info(
      `🎉 Would send DM to ${discordUserId}: Welcome to Core membership! Monthly Coffee subscription activated (${tierName || "Monthly Coffee"}) - $${subscriptionAmount}/month = ${monthlyCredits} Cores monthly`,
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
