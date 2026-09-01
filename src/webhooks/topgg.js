/**
 * top.gg Vote Webhook Handler
 * Implements proper signature verification per top.gg's official docs
 * @module webhooks/topgg
 */

import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import { getBotContext } from "../utils/core/BotContext.js";
import crypto from "crypto";

const logger = getLogger();

// Guards against concurrent retroactive reward claims (missed-webhook self-heal)
const claimingVoteRewards = new Set();

// Get webhook secret from environment
const WEBHOOK_SECRET = process.env.TOPGG_WEBHOOK_AUTH;

if (!WEBHOOK_SECRET) {
  logger.warn(
    "⚠️ top.gg webhook: No WEBHOOK_SECRET configured. Set TOPGG_WEBHOOK_AUTH in .env",
  );
}

/**
 * Verify top.gg webhook signature
 * @param {Object} params - Verification parameters
 * @param {string} params.secret - Webhook secret (whs_...)
 * @param {string} params.signature - Signature from x-topgg-signature header
 * @param {Object} params.body - Parsed JSON body
 * @param {Buffer} params.rawBody - Raw body buffer
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature({ secret, signature, body, rawBody }) {
  if (!signature) {
    logger.warn("⚠️ top.gg webhook: Missing signature header");
    return false;
  }

  if (!secret) {
    logger.warn("⚠️ top.gg webhook: No secret configured");
    return false;
  }

  try {
    // Extract timestamp and signature from header
    // Format: t={unix timestamp},v1={signature}
    const parsedSignature = signature.split(",").map(part => part.split("="));
    const sigObj = Object.fromEntries(parsedSignature);
    const timestamp = sigObj["t"];
    const expectedSignature = sigObj["v1"];

    if (!timestamp || !expectedSignature) {
      logger.warn("⚠️ top.gg webhook: Invalid signature format", {
        hasTimestamp: !!timestamp,
        hasSignature: !!expectedSignature,
        rawHeader: signature,
      });
      return false;
    }

    // Create the signature payload
    // Use rawBody if available, otherwise stringify the parsed body
    const bodyStr = rawBody ? rawBody.toString("utf8") : JSON.stringify(body);
    const payload = `${timestamp}.${bodyStr}`;

    // Generate HMAC SHA-256 hash
    const hmac = crypto.createHmac("sha256", secret);
    const computedSignature = hmac.update(payload).digest("hex");

    // Compare signatures using constant-time comparison
    // Use Buffer.from with utf8 (not hex) to safely handle length mismatches
    const sigBuffer = Buffer.from(expectedSignature, "utf8");
    const compBuffer = Buffer.from(computedSignature, "utf8");

    if (sigBuffer.length !== compBuffer.length) {
      logger.warn("⚠️ top.gg webhook: Signature length mismatch");
      return false;
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, compBuffer);

    if (!isValid) {
      logger.warn("⚠️ top.gg webhook: Signature mismatch");
    }

    return isValid;
  } catch (error) {
    logger.error("❌ top.gg webhook: Signature verification failed:", error);
    return false;
  }
}

/**
 * Handle top.gg vote webhook with proper signature verification
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} client - Discord client
 */
export async function handleTopggVote(req, res, client) {
  try {
    // Get signature from header
    const signature = req.headers["x-topgg-signature"];

    // Get raw body if available (captured by express.raw middleware)
    const rawBody = req.rawBody;

    // Parse vote data from request body
    const webhookData = req.body;

    // Verify signature — reject if secret not configured
    if (!WEBHOOK_SECRET) {
      logger.error(
        "⚠️ top.gg webhook: TOPGG_WEBHOOK_AUTH not configured — rejecting request",
      );
      return res.status(500).json({
        success: false,
        message: "Webhook not configured",
      });
    }

    const isValid = verifyWebhookSignature({
      secret: WEBHOOK_SECRET,
      signature: signature,
      body: webhookData,
      rawBody: rawBody,
    });

    if (!isValid) {
      logger.warn("⚠️ top.gg webhook: Invalid signature - rejecting request");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid signature",
      });
    }

    logger.debug("✅ top.gg webhook: Signature verified successfully");

    // Handle different top.gg webhook formats
    const parsedVote = parseVoteData(webhookData);

    if (!parsedVote.userId) {
      logger.warn("⚠️ top.gg webhook: Could not parse user ID", {
        body: webhookData,
      });
      return res.status(400).json({
        success: false,
        message: "Missing user ID",
      });
    }

    logger.info(
      `🗳️ top.gg: Vote received from ${parsedVote.username || parsedVote.userId} (${parsedVote.userId})`,
    );

    // Process the vote
    await processVote(
      { user: parsedVote.userId, username: parsedVote.username },
      client,
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("❌ top.gg webhook error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Parse vote data from different top.gg webhook formats
 * @param {Object} webhookData - Raw webhook payload
 * @returns {Object} Parsed vote with userId and username
 */
function parseVoteData(webhookData) {
  // New nested format (top.gg API v2)
  if (webhookData.type === "vote.create" && webhookData.data) {
    return {
      userId: webhookData.data.user?.platform_id,
      username: webhookData.data.user?.name,
    };
  }

  // Test webhook format
  if (webhookData.type === "webhook.test" && webhookData.data) {
    return {
      userId: webhookData.data.user?.platform_id,
      username: webhookData.data.user?.name,
    };
  }

  // SDK format (flat)
  if (webhookData.user && typeof webhookData.user === "string") {
    return {
      userId: webhookData.user,
      username: webhookData.username,
    };
  }

  // Nested object format
  if (webhookData.user && typeof webhookData.user === "object") {
    return {
      userId: webhookData.user.platform_id || webhookData.user.id,
      username: webhookData.user.name,
    };
  }

  // Old flat format
  return {
    userId: webhookData.user,
    username: webhookData.username,
  };
}

/**
 * Process a vote and award Core Credits
 * @param {Object} vote - Vote object from top.gg
 * @param {Object} client - Discord client
 */
async function processVote(vote, client) {
  const userId = vote.user;
  const username = vote.username;

  logger.info(
    `🗳️ top.gg: Processing vote from ${username || userId} (${userId})`,
  );

  // Get database manager and check if user can vote (12 hour cooldown)
  const dbManager = await getDatabaseManager();

  // Check if database is initialized
  if (!dbManager || !dbManager.coreCredits) {
    logger.error("❌ top.gg: Database not initialized");
    throw new Error("Database not ready");
  }

  const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
  const userCredits = await dbManager.coreCredits.collection.findOne({
    userId,
  });

  if (userCredits && userCredits.lastVote) {
    const timeSinceVote = Date.now() - userCredits.lastVote;
    if (timeSinceVote < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - timeSinceVote;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      logger.info(
        `⏰ top.gg: User ${userId} voted too soon (${hours}h ${minutes}m remaining)`,
      );
      return; // Cooldown active, don't reward
    }
  }

  // Calculate Vote Streak (36h grace window to maintain streak)
  const STREAK_WINDOW_MS = 36 * 60 * 60 * 1000;
  let voteStreak = 1;
  if (userCredits && userCredits.lastVote) {
    const timeSinceLastVote = Date.now() - userCredits.lastVote;
    if (timeSinceLastVote <= STREAK_WINDOW_MS) {
      voteStreak = (userCredits.voteStreak || 1) + 1;
    } else {
      voteStreak = 1; // Expired, reset
    }
  }

  // Tightly balanced reward scaling (Hard Cap at 8 Sparks max):
  // Streak 1-2: 5 Sparks
  // Streak 3-6: 6 Sparks
  // Streak 7-13: 7 Sparks
  // Streak 14+: 8 Sparks (Max Cap)
  let REWARD_AMOUNT = 5;
  if (voteStreak >= 14) {
    REWARD_AMOUNT = 8;
  } else if (voteStreak >= 7) {
    REWARD_AMOUNT = 7;
  } else if (voteStreak >= 3) {
    REWARD_AMOUNT = 6;
  }

  // Credit Sparks for voting
  await dbManager.coreCredits.updateSparks(userId, REWARD_AMOUNT);

  // Update vote metadata and streak
  await dbManager.coreCredits.collection.updateOne(
    { userId },
    {
      $set: {
        lastVote: Date.now(),
        totalVotes: (userCredits?.totalVotes || 0) + 1,
        voteStreak: voteStreak,
      },
    },
    { upsert: true },
  );

  // Log transaction in payments collection for dashboard history
  if (dbManager.payments) {
    try {
      await dbManager.payments.create({
        paymentId: `vote_topgg_${userId}_${Date.now()}`,
        discordId: userId,
        provider: "top.gg",
        type: "vote",
        status: "completed",
        amount: 0,
        currency: "CORES",
        sparksGranted: REWARD_AMOUNT,
        tier: "vote_reward",
        metadata: {
          username: username || null,
          totalVotes: (userCredits?.totalVotes || 0) + 1,
          voteStreak: voteStreak,
        },
      });
    } catch (txError) {
      logger.warn(
        `⚠️ top.gg: Failed to log vote transaction for ${userId}: ${txError.message}`,
      );
    }
  }

  logger.info(
    `✅ top.gg: Rewarded ${userId} with ${REWARD_AMOUNT} Sparks ⚡ (Streak: ${voteStreak}, Total votes: ${(userCredits?.totalVotes || 0) + 1})`,
  );

  // Create in-app notification
  if (dbManager.notifications) {
    try {
      await dbManager.notifications.create({
        userId,
        type: "vote_reward",
        title: "Vote Reward Received!",
        message: `+${REWARD_AMOUNT} Sparks ⚡ credited for voting on top.gg`,
        icon: "vote",
        metadata: {
          sparksGranted: REWARD_AMOUNT,
          totalVotes: (userCredits?.totalVotes || 0) + 1,
        },
      });
    } catch (notifError) {
      logger.warn(
        `⚠️ top.gg: Failed to create notification for ${userId}: ${notifError.message}`,
      );
    }
  }

  // Send thank you DM (if possible)
  try {
    const discordClient = client || getBotContext().client;
    if (discordClient && userId) {
      const discordUser = await discordClient.users.fetch(userId);

      const { EmbedBuilder } = await import("discord.js");
      const { getMentionableCommand } = await import(
        "../utils/commandUtils.js"
      );

      const thankYouEmbed = new EmbedBuilder()
        .setTitle("🎉 Thanks for Voting!")
        .setColor(0xff6b6b)
        .setDescription(
          `Thank you **${username || "voter"}** for voting for Role Reactor on top.gg!`,
        )
        .addFields(
          {
            name: "🎁 Reward",
            value: `✅ **⚡ ${REWARD_AMOUNT} Sparks** added! *(Vote Streak: ${voteStreak} 🔥)*`,
            inline: false,
          },
          {
            name: "⏰ Next Vote",
            value: "You can vote again in **12 hours**!",
            inline: false,
          },
          {
            name: "💡 Check Your Balance",
            value: `Use ${getMentionableCommand(discordClient, "balance")} to check your Cores 🔮 & Sparks ⚡ balance!`,
            inline: false,
          },
        )
        .setFooter({ text: "Your support means everything! ❤️" })
        .setTimestamp();

      await discordUser.send({ embeds: [thankYouEmbed] });
      logger.info(`📩 top.gg: Sent thank you DM to ${userId}`);
    }
  } catch (_dmError) {
    logger.warn(
      `⚠️ top.gg: Could not send DM to ${userId} (DMs closed or bot blocked)`,
    );
    // Not critical, continue
  }
}

/**
 * Query top.gg API to check if a user has voted in the last 12 hours.
 * This is the authoritative source — works even without webhooks reaching this server.
 * @param {string} userId - Discord user ID
 * @param {string} botId - Bot ID on top.gg
 * @returns {Promise<boolean|null>} true=voted, false=not voted, null=API unavailable
 */
async function checkTopggVoteApi(userId, botId) {
  const token = process.env.TOPGG_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://top.gg/api/bots/${botId}/check?userId=${userId}`,
      {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(5000), // 5s timeout
      },
    );
    if (!res.ok) return null;
    const data = /** @type {{ voted: number }} */ (await res.json());
    return data.voted === 1;
  } catch (err) {
    logger.warn(`⚠️ top.gg API check failed for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Check if a user has voted recently.
 * Uses top.gg API as source of truth when TOPGG_API_TOKEN is configured,
 * with DB as fallback for totalVotes and timestamps.
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} Vote status
 */
export async function getVoteStatus(userId) {
  try {
    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
    const BOT_ID = process.env.DISCORD_CLIENT_ID || "1392714201558159431";

    // Query DB and top.gg API in parallel for best performance
    const [dbResult, topggVoted] = await Promise.all([
      getDatabaseManager().then(db =>
        db.coreCredits?.collection.findOne({ userId }),
      ),
      checkTopggVoteApi(userId, BOT_ID),
    ]);

    let userCredits = dbResult;

    // Self-heal missed webhooks: top.gg says the user voted within the last 12h,
    // but our DB shows no reward was credited for that window. Credit it now.
    if (topggVoted === true) {
      const timeSinceLastVote = userCredits?.lastVote
        ? Date.now() - userCredits.lastVote
        : Infinity;
      if (timeSinceLastVote >= COOLDOWN_MS && !claimingVoteRewards.has(userId)) {
        claimingVoteRewards.add(userId);
        try {
          logger.info(
            `🩹 top.gg: Retroactively crediting missed vote reward for ${userId}`,
          );
          await processVote({ user: userId, username: null }, null);
          userCredits = await getDatabaseManager().then(db =>
            db.coreCredits?.collection.findOne({ userId }),
          );
        } catch (healError) {
          logger.error(
            `❌ top.gg: Retroactive vote reward failed for ${userId}: ${healError.message}`,
          );
        } finally {
          claimingVoteRewards.delete(userId);
        }
      }
    }

    const totalVotes = userCredits?.totalVotes || 0;
    const lastVote = userCredits?.lastVote ?? null;

    const STREAK_WINDOW_MS = 36 * 60 * 60 * 1000;
    const isStreakActive = userCredits?.lastVote
      ? Date.now() - userCredits.lastVote <= STREAK_WINDOW_MS
      : false;
    const voteStreak = isStreakActive ? userCredits?.voteStreak || 0 : 0;

    // top.gg API is authoritative for whether the user has voted in the 12h window
    if (topggVoted !== null) {
      const hasVoted = topggVoted;
      const canVote = !hasVoted;
      const nextVote =
        canVote || !lastVote ? null : new Date(lastVote + COOLDOWN_MS);

      return {
        hasVoted,
        canVote,
        lastVote: lastVote ? new Date(lastVote) : null,
        nextVote,
        totalVotes,
        voteStreak,
      };
    }

    // Fallback: use DB lastVote timestamp if top.gg API is unavailable
    if (!lastVote) {
      return {
        hasVoted: false,
        canVote: true,
        lastVote: null,
        nextVote: null,
        totalVotes,
        voteStreak: 0,
      };
    }

    const timeSinceVote = Date.now() - lastVote;
    const canVote = timeSinceVote >= COOLDOWN_MS;
    const nextVote = canVote ? null : new Date(lastVote + COOLDOWN_MS);

    return {
      hasVoted: true,
      canVote,
      lastVote: new Date(lastVote),
      nextVote,
      totalVotes,
      voteStreak,
    };
  } catch (error) {
    logger.error("Error getting vote status:", error);
    return {
      hasVoted: false,
      canVote: false,
      error: "Failed to get vote status",
    };
  }
}
