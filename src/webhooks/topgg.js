/**
 * top.gg Vote Webhook Handler
 * Uses official @top-gg/sdk for proper authentication and parsing
 * @module webhooks/topgg
 */

import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import Topgg from "@top-gg/sdk";

const logger = getLogger();

// Initialize top.gg webhook with auth token
const webhookAuth = process.env.TOPGG_WEBHOOK_AUTH || process.env.TOPGG_TOKEN;
const webhook = webhookAuth ? new Topgg.Webhook(webhookAuth) : null;

if (!webhook) {
  logger.warn('⚠️ top.gg webhook: No auth token configured. Set TOPGG_WEBHOOK_AUTH in .env');
}

/**
 * Handle top.gg vote webhook using official SDK
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} client - Discord client
 */
export async function handleTopggVote(req, res, client) {
  try {
    // If webhook SDK is configured, use it for authentication
    if (webhook) {
      // The SDK middleware handles authentication and parsing
      // We'll manually call the listener logic here
      const vote = await new Promise((resolve, reject) => {
        webhook.listener((vote) => {
          resolve(vote);
        })(req, res, () => {}); // Express next() callback
      });
      
      // Vote is already authenticated and parsed by SDK
      await processVote(vote, client);
      return res.status(200).json({ success: true });
    }
    
    // Fallback: Handle without SDK (for testing or if no auth token)
    // Parse vote data - top.gg uses nested structure
    const webhookData = req.body;
    
    // Handle both old and new top.gg webhook formats
    let userId, username;
    
    if (webhookData.type === 'vote.create' && webhookData.data) {
      // New format (nested)
      userId = webhookData.data.user?.platform_id;
      username = webhookData.data.user?.name;
    } else if (webhookData.user && typeof webhookData.user === 'string') {
      // SDK format (flat)
      userId = webhookData.user;
      username = webhookData.username;
    } else if (webhookData.user && typeof webhookData.user === 'object') {
      // Nested object format
      userId = webhookData.user.platform_id || webhookData.user.id;
      username = webhookData.user.name;
    } else {
      // Old format (flat)
      userId = webhookData.user;
      username = webhookData.username;
    }
    
    if (!userId) {
      logger.warn('⚠️ top.gg webhook: Missing user ID', { body: webhookData });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing user ID' 
      });
    }

    logger.info(`🗳️ top.gg: Vote received from ${username || userId} (${userId})`);

    // Process the vote
    await processVote({ user: userId, username }, client);
    return res.status(200).json({ success: true });
    
  } catch (error) {
    logger.error('❌ top.gg webhook error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}

/**
 * Process a vote and award Core Credits
 * @param {Object} vote - Vote object from top.gg
 * @param {Object} client - Discord client
 */
async function processVote(vote, client) {
  const userId = vote.user;
  const username = vote.username;
  
  logger.info(`🗳️ top.gg: Processing vote from ${username || userId} (${userId})`);
  
  // Get database manager and check if user can vote (12 hour cooldown)
  const dbManager = await getDatabaseManager();
  
  // Check if database is initialized
  if (!dbManager || !dbManager.coreCredits) {
    logger.error('❌ top.gg: Database not initialized');
    throw new Error('Database not ready');
  }
  
  const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
  const userCredits = await dbManager.coreCredits.collection.findOne({ userId });
  
  if (userCredits && userCredits.lastVote) {
    const timeSinceVote = Date.now() - userCredits.lastVote;
    if (timeSinceVote < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - timeSinceVote;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      
      logger.info(`⏰ top.gg: User ${userId} voted too soon (${hours}h ${minutes}m remaining)`);
      return; // Cooldown active, don't reward
    }
  }
  
  // Reward user with 1 Core Credit
  const REWARD_AMOUNT = 1;
  
  await dbManager.coreCredits.collection.updateOne(
    { userId },
    { 
      $inc: { balance: REWARD_AMOUNT },
      $set: { 
        lastVote: Date.now(),
        totalVotes: (userCredits?.totalVotes || 0) + 1
      }
    },
    { upsert: true }
  );
  
  logger.info(`✅ top.gg: Rewarded ${userId} with ${REWARD_AMOUNT} Core (Total votes: ${(userCredits?.totalVotes || 0) + 1})`);
  
  // Send thank you DM (if possible)
  try {
    const discordClient = client || global.discordClient;
    if (discordClient && userId) {
      const discordUser = await discordClient.users.fetch(userId);
      
      const { EmbedBuilder } = await import('discord.js');
      const thankYouEmbed = new EmbedBuilder()
        .setTitle('🎉 Thanks for Voting!')
        .setColor(0xff6b6b)
        .setDescription(
          `Thank you **${username || 'voter'}** for voting for Role Reactor on top.gg!`
        )
        .addFields(
          {
            name: '🎁 Reward',
            value: `✅ **${REWARD_AMOUNT} Core Credit** added to your balance!`,
            inline: false,
          },
          {
            name: '⏰ Next Vote',
            value: 'You can vote again in **12 hours**!',
            inline: false,
          },
          {
            name: '💡 Use Your Core',
            value: 'Use `/core` to check your balance and see what you can do with Core Credits!',
            inline: false,
          },
        )
        .setFooter({ text: 'Your support means everything! ❤️' })
        .setTimestamp();
      
      await discordUser.send({ embeds: [thankYouEmbed] });
      logger.info(`📩 top.gg: Sent thank you DM to ${userId}`);
    }
  } catch (dmError) {
    logger.warn(
      `⚠️ top.gg: Could not send DM to ${userId} (DMs closed or bot blocked)`,
    );
    // Not critical, continue
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
    const userCredits = await dbManager.coreCredits?.collection.findOne({ userId });
    
    if (!userCredits || !userCredits.lastVote) {
      return {
        hasVoted: false,
        canVote: true,
        lastVote: null,
        nextVote: null,
        totalVotes: 0
      };
    }
    
    const timeSinceVote = Date.now() - userCredits.lastVote;
    const canVote = timeSinceVote >= COOLDOWN_MS;
    const nextVote = canVote ? null : new Date(userCredits.lastVote + COOLDOWN_MS);
    
    return {
      hasVoted: true,
      canVote,
      lastVote: new Date(userCredits.lastVote),
      nextVote,
      totalVotes: userCredits.totalVotes || 0
    };
  } catch (error) {
    logger.error('Error getting vote status:', error);
    return {
      hasVoted: false,
      canVote: false,
      error: 'Failed to get vote status'
    };
  }
}
