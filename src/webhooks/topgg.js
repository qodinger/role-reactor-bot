/**
 * top.gg Vote Webhook Handler
 * Receives vote notifications from top.gg and rewards users with Core Credits
 * @module webhooks/topgg
 */

import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";

const logger = getLogger();

/**
 * Handle top.gg vote webhook
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} client - Discord client
 */
export async function handleTopggVote(req, res, client) {
  try {
    // Verify authorization token
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.TOPGG_TOKEN;

    if (!authHeader || !expectedToken) {
      logger.warn("⚠️ top.gg webhook: Missing authorization");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== expectedToken) {
      logger.warn("⚠️ top.gg webhook: Invalid authorization token");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Parse vote data
    const vote = req.body;

    if (!vote || !vote.user) {
      logger.warn("⚠️ top.gg webhook: Invalid vote data", { body: req.body });
      return res
        .status(400)
        .json({ success: false, message: "Invalid vote data" });
    }

    const { user: userId, username } = vote;

    logger.info(`🗳️ top.gg: Vote received from ${username || userId}`);

    // Get database and check if user can vote (12 hour cooldown)
    const dbManager = await getDatabaseManager();
    const db = await dbManager.getDb();

    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
    const userCredits = await db.collection("core_credits").findOne({ userId });

    if (userCredits && userCredits.lastVote) {
      const timeSinceVote = Date.now() - userCredits.lastVote;
      if (timeSinceVote < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - timeSinceVote;
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor(
          (remaining % (60 * 60 * 1000)) / (60 * 1000),
        );

        logger.info(
          `⏰ top.gg: User ${userId} voted too soon (${hours}h ${minutes}m remaining)`,
        );
        return res.status(200).json({
          success: true,
          message: "Cooldown active",
          cooldown: { hours, minutes },
        });
      }
    }

    // Reward user with 1 Core Credit
    const REWARD_AMOUNT = 1;

    await db.collection("core_credits").updateOne(
      { userId },
      {
        $inc: { balance: REWARD_AMOUNT },
        $set: {
          lastVote: Date.now(),
          totalVotes: (userCredits?.totalVotes || 0) + 1,
        },
      },
      { upsert: true },
    );

    logger.info(
      `✅ top.gg: Rewarded ${userId} with ${REWARD_AMOUNT} Core (Total votes: ${(userCredits?.totalVotes || 0) + 1})`,
    );

    // Send thank you DM (if possible)
    try {
      const discordClient = global.discordClient || client;
      const discordUser = await discordClient.users.fetch(userId);

      const { EmbedBuilder } = await import("discord.js");
      const thankYouEmbed = new EmbedBuilder()
        .setTitle("🎉 Thanks for Voting!")
        .setColor(0xff6b6b)
        .setDescription(
          `Thank you **${username || "voter"}** for voting for Role Reactor on top.gg!`,
        )
        .addFields(
          {
            name: "🎁 Reward",
            value: `✅ **${REWARD_AMOUNT} Core Credit** added to your balance!`,
            inline: false,
          },
          {
            name: "⏰ Next Vote",
            value: "You can vote again in **12 hours**!",
            inline: false,
          },
          {
            name: "💡 Use Your Core",
            value:
              "Use `/core` to check your balance and see what you can do with Core Credits!",
            inline: false,
          },
        )
        .setFooter({ text: "Your support means everything! ❤️" })
        .setTimestamp();

      await discordUser.send({ embeds: [thankYouEmbed] });
      logger.info(`📩 top.gg: Sent thank you DM to ${userId}`);
    } catch (_dmError) {
      logger.warn(
        `⚠️ top.gg: Could not send DM to ${userId} (DMs closed or bot blocked)`,
      );
      // Not critical, continue
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: "Vote processed successfully",
      reward: REWARD_AMOUNT,
    });
  } catch (error) {
    logger.error("❌ top.gg webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Check if a user has voted recently
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} Vote status
 */
export async function getVoteStatus(userId) {
  try {
    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

    const dbManager = await getDatabaseManager();
    const db = await dbManager.getDb();
    const userCredits = await db.collection("core_credits").findOne({ userId });

    if (!userCredits || !userCredits.lastVote) {
      return {
        hasVoted: false,
        canVote: true,
        lastVote: null,
        nextVote: null,
        totalVotes: 0,
      };
    }

    const timeSinceVote = Date.now() - userCredits.lastVote;
    const canVote = timeSinceVote >= COOLDOWN_MS;
    const nextVote = canVote
      ? null
      : new Date(userCredits.lastVote + COOLDOWN_MS);

    return {
      hasVoted: true,
      canVote,
      lastVote: new Date(userCredits.lastVote),
      nextVote,
      totalVotes: userCredits.totalVotes || 0,
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
