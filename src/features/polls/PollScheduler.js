import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import { THEME, EMOJIS } from "../../config/theme.js";

const logger = getLogger();

class PollScheduler {
  constructor(client) {
    this.client = client;
    this.updateInterval = null;
    this.isRunning = false;
    this.updateFrequency = 30000; // Update every 30 seconds for expiration checks
  }

  /**
   * Start the poll scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn("Poll scheduler is already running");
      return;
    }

    logger.info("🔄 Starting poll scheduler...");
    this.isRunning = true;

    // Run initial check for expired polls first
    this.checkExpiredPollsOnStartup().catch(error => {
      logger.error("Error checking expired polls on startup:", error);
    });

    // Then run normal processing
    this.processPolls().catch(error => {
      logger.error("Error in initial poll processing:", error);
    });

    // Set up periodic updates with smart frequency
    this.scheduleNextUpdate();

    logger.info(
      `✅ Poll scheduler started (smart updates based on poll urgency)`,
    );
  }

  /**
   * Stop the poll scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Poll scheduler is not running");
      return;
    }

    logger.info("🛑 Stopping poll scheduler...");
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.info("✅ Poll scheduler stopped");
  }

  /**
   * Check for expired polls on startup and end them immediately
   */
  async checkExpiredPollsOnStartup() {
    try {
      logger.info("🚀 Starting expired poll check on startup...");
      const storageManager = await getStorageManager();
      const polls = await storageManager.getAllPolls();

      logger.info(
        `📊 Found ${Object.keys(polls).length} total polls in storage`,
      );

      const activePolls = Object.values(polls).filter(poll => poll.isActive);
      logger.info(`🔍 Found ${activePolls.length} active polls`);

      if (activePolls.length === 0) {
        logger.info("No active polls to check on startup");
        return;
      }

      logger.info(
        `🔍 Checking ${activePolls.length} active polls for expiration on startup...`,
      );

      const now = new Date();
      let expiredCount = 0;
      let hasChanges = false;

      for (const poll of activePolls) {
        const createdAt = new Date(poll.createdAt);
        const durationMs = poll.duration * 60 * 60 * 1000;
        const endTime = new Date(createdAt.getTime() + durationMs);

        logger.info(`🔍 Checking poll ${poll.id}:`);
        logger.info(`  Question: "${poll.question}"`);
        logger.info(`  Created: ${createdAt.toISOString()}`);
        logger.info(`  Duration: ${poll.duration} hours`);
        logger.info(`  End Time: ${endTime.toISOString()}`);
        logger.info(`  Current Time: ${now.toISOString()}`);
        logger.info(`  Is Expired: ${now >= endTime}`);

        if (now >= endTime) {
          logger.info(
            `⏰ Poll ${poll.id} expired while bot was offline, ending now`,
          );

          // Mark poll as expired
          poll.isActive = false;
          poll.endedAt = new Date().toISOString();
          poll.status = "ended";

          // Update poll in storage
          await storageManager.updatePoll(poll.id, poll);

          // Update poll message to show it's ended
          await this.updatePollMessage(poll, storageManager, polls);

          // Send notification that poll has ended
          await this.notifyPollEnded(poll);

          expiredCount++;
          hasChanges = true;
        } else {
          logger.info(`✅ Poll ${poll.id} is still active`);
        }
      }

      // Log results
      if (hasChanges) {
        logger.info(`✅ Ended ${expiredCount} expired polls on startup`);
      } else {
        logger.info("✅ No polls expired while bot was offline");
      }
    } catch (error) {
      logger.error("Error checking expired polls on startup:", error);
    }
  }

  /**
   * Process all active polls
   */
  async processPolls() {
    try {
      const storageManager = await getStorageManager();
      const polls = await storageManager.getAllPolls();

      const activePolls = Object.values(polls).filter(poll => poll.isActive);

      if (activePolls.length === 0) {
        return; // No active polls to process
      }

      logger.debug(`Processing ${activePolls.length} active polls`);

      // Performance monitoring for large numbers of polls
      if (activePolls.length > 50) {
        logger.warn(
          `⚠️ High poll count detected: ${activePolls.length} active polls. Consider monitoring performance.`,
        );
      }

      // Check for expired polls first
      const now = new Date();
      const expiredPolls = [];
      const stillActivePolls = [];

      // Separate expired and active polls efficiently
      for (const poll of activePolls) {
        const createdAt = new Date(poll.createdAt);
        const durationMs = poll.duration * 60 * 60 * 1000;
        const endTime = new Date(createdAt.getTime() + durationMs);

        if (now >= endTime) {
          expiredPolls.push(poll);
        } else {
          stillActivePolls.push(poll);
        }
      }

      // Process expired polls in parallel (with concurrency limit)
      if (expiredPolls.length > 0) {
        logger.info(
          `Found ${expiredPolls.length} expired polls, ending them...`,
        );
        await this.processExpiredPollsInParallel(expiredPolls, storageManager);
      }

      // Update remaining active polls in parallel (with concurrency limit)
      if (stillActivePolls.length > 0) {
        await this.updateActivePollsInParallel(
          stillActivePolls,
          storageManager,
        );
      }
    } catch (error) {
      logger.error("Error processing polls:", error);
    }
  }

  /**
   * Process expired polls in parallel with concurrency limit
   */
  async processExpiredPollsInParallel(expiredPolls, storageManager) {
    const concurrencyLimit = 5; // Process max 5 polls at once
    const chunks = [];

    for (let i = 0; i < expiredPolls.length; i += concurrencyLimit) {
      chunks.push(expiredPolls.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async poll => {
          await this.endExpiredPoll(poll, storageManager, {});
        }),
      );

      // Small delay between chunks to avoid overwhelming Discord API
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      }
    }
  }

  /**
   * Update active polls in parallel with concurrency limit
   */
  async updateActivePollsInParallel(activePolls, storageManager) {
    const concurrencyLimit = 10; // Process max 10 polls at once
    const chunks = [];

    for (let i = 0; i < activePolls.length; i += concurrencyLimit) {
      chunks.push(activePolls.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async poll => {
          await this.updatePollMessage(poll, storageManager, {});
        }),
      );

      // Small delay between chunks to avoid overwhelming Discord API
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => {
          setTimeout(resolve, 50);
        });
      }
    }
  }

  /**
   * Schedule the next update based on poll urgency
   */
  async scheduleNextUpdate() {
    if (!this.isRunning) return;

    // Clear existing interval
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
    }

    // Get the optimal update frequency based on active polls
    const updateFrequency = await this.getNextUpdateFrequency();

    this.updateInterval = setTimeout(() => {
      this.processPolls().catch(error => {
        logger.error("Error in periodic poll processing:", error);
      });

      // Schedule the next update
      this.scheduleNextUpdate();
    }, updateFrequency);
  }

  /**
   * Get the next update frequency based on active polls
   */
  async getNextUpdateFrequency() {
    try {
      const storageManager = await getStorageManager();
      const polls = await storageManager.getAllPolls();
      const activePolls = Object.values(polls).filter(poll => poll.isActive);

      if (activePolls.length === 0) {
        return 60000; // 1 minute when no active polls
      }

      // Find the poll with the least time remaining
      let shortestTimeRemaining = Infinity;

      for (const poll of activePolls) {
        const createdAt = new Date(poll.createdAt);
        const durationMs = poll.duration * 60 * 60 * 1000;
        const endTime = new Date(createdAt.getTime() + durationMs);
        const now = new Date();
        const remainingMs = endTime.getTime() - now.getTime();

        if (remainingMs > 0 && remainingMs < shortestTimeRemaining) {
          shortestTimeRemaining = remainingMs;
        }
      }

      // Smart update frequency based on shortest remaining time
      if (shortestTimeRemaining <= 2 * 60 * 1000) {
        // Less than 2 minutes: update every 10 seconds
        return 10000;
      } else if (shortestTimeRemaining <= 10 * 60 * 1000) {
        // Less than 10 minutes: update every 30 seconds
        return 30000;
      } else if (shortestTimeRemaining <= 60 * 60 * 1000) {
        // Less than 1 hour: update every 2 minutes
        return 120000;
      } else {
        // More than 1 hour: update every 5 minutes
        return 300000;
      }
    } catch (error) {
      logger.error("Error calculating update frequency:", error);
      return 30000; // Fallback to 30 seconds
    }
  }

  /**
   * End an expired poll
   */
  async endExpiredPoll(poll, storageManager, polls) {
    try {
      logger.info(`⏰ Poll ${poll.id} has expired, ending automatically`);

      // Mark poll as inactive
      poll.isActive = false;
      poll.endedAt = new Date().toISOString();
      poll.status = "ended";

      // Update storage
      await storageManager.updatePoll(poll.id, poll);

      // Update the poll message to show it's ended
      await this.updatePollMessage(poll, storageManager, polls);

      // Try to send a notification to the channel
      await this.notifyPollEnded(poll);
    } catch (error) {
      logger.error(`Error ending expired poll ${poll.id}:`, error);
    }
  }

  /**
   * Update a poll message with current data
   */
  async updatePollMessage(poll, _storageManager, _polls) {
    // Skip custom poll message updates for native Discord polls
    // Native polls handle their own UI updates automatically
    logger.debug(
      `Skipping custom poll message update for native poll ${poll.id}`,
    );
    return;
  }

  /**
   * Notify that a poll has ended
   */
  async notifyPollEnded(poll) {
    try {
      const guild = this.client.guilds.cache.get(poll.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(poll.channelId);
      if (!channel) return;

      const resultsEmbed = this.createResultsEmbed(poll);

      // Create a more informative notification
      const pollMessageLink = `https://discord.com/channels/${poll.guildId}/${poll.channelId}/${poll.messageId}`;

      const notificationEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.TIME.ALARM} Poll Ended: ${poll.question}`)
        .setDescription(
          `The poll has ended and is no longer accepting votes.\n\n${EMOJIS.ACTIONS.LINK} [View Original Poll](${pollMessageLink})`,
        )
        .setColor(THEME.ERROR) // Error color for ended poll
        .setTimestamp()
        .setFooter({
          text: `Poll ID: ${poll.id}`,
        });

      await channel.send({
        content: `${EMOJIS.UI.PROGRESS} **Poll Results**`,
        embeds: [notificationEmbed, resultsEmbed],
      });

      logger.info(`Sent poll end notification for ${poll.id}`);
    } catch (error) {
      logger.error(
        `Error sending poll end notification for ${poll.id}:`,
        error,
      );
    }
  }

  /**
   * Create updated poll embed with current results
   */
  createUpdatedPollEmbed(poll) {
    const isActive = poll.isActive;

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.UI.PROGRESS} ${poll.question}`)
      .setDescription(
        isActive
          ? `Select ${poll.allowMultiple ? "one or more answers" : "one answer"} by clicking the buttons below`
          : `**${EMOJIS.STATUS.ERROR} This poll has ended and no longer accepts votes**`,
      )
      .setColor(isActive ? THEME.PRIMARY : THEME.ERROR)
      .setTimestamp()
      .setFooter({
        text: `Poll ID: ${poll.id} • Duration: ${this.formatDuration(poll.duration)} • ${poll.allowMultiple ? "Multiple choice" : "Single choice"}`,
      });

    // Calculate vote counts
    const voteCounts = {};
    poll.options.forEach((option, index) => {
      voteCounts[index] = 0;
    });

    if (poll.votes) {
      Object.values(poll.votes).forEach(userVotes => {
        if (Array.isArray(userVotes)) {
          userVotes.forEach(optionIndex => {
            if (voteCounts[optionIndex] !== undefined) {
              voteCounts[optionIndex]++;
            }
          });
        }
      });
    }

    // Calculate total votes
    const totalVotes = Object.values(voteCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Add poll options with vote counts
    poll.options.forEach((option, index) => {
      const votes = voteCounts[index] || 0;
      const percentage =
        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const emoji = this.getPollEmoji(index, poll.customEmojis);

      embed.addFields({
        name: `${emoji} ${option}`,
        value: `**${votes} votes** • ${percentage}%`,
        inline: true,
      });
    });

    // Add poll status
    const remainingTime = this.calculateRemainingTime(poll);
    const status = poll.isActive
      ? `${EMOJIS.STATUS.SUCCESS} Active`
      : `${EMOJIS.STATUS.ERROR} Ended`;

    const statusValue = isActive
      ? `**Total Votes:** ${totalVotes}\n**Time Remaining:** ${remainingTime}\n**Status:** ${status}`
      : `**Total Votes:** ${totalVotes}\n**Time Remaining:** Poll ended\n**Status:** ${status}`;

    embed.addFields({
      name: `${EMOJIS.UI.PROGRESS} Poll Status`,
      value: statusValue,
      inline: false,
    });

    return embed;
  }

  /**
   * Create updated components
   */
  createUpdatedComponents(poll) {
    const components = [];
    const maxButtonsPerRow = 5;

    // Create voting buttons
    for (let i = 0; i < poll.options.length; i += maxButtonsPerRow) {
      const row = new ActionRowBuilder();

      for (
        let j = i;
        j < Math.min(i + maxButtonsPerRow, poll.options.length);
        j++
      ) {
        const option = poll.options[j];
        const emoji = this.getPollEmoji(j, poll.customEmojis);

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote-${poll.id}-${j}`)
            .setLabel(
              option.length > 20 ? `${option.substring(0, 17)}...` : option,
            )
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji)
            .setDisabled(!poll.isActive), // Disable if poll is ended
        );
      }

      components.push(row);
    }

    // Add management buttons
    const managementRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_results-${poll.id}`)
        .setLabel(`${EMOJIS.UI.PROGRESS} View Results`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`poll_refresh-${poll.id}`)
        .setLabel(`${EMOJIS.ACTIONS.REFRESH} Refresh`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`poll_end-${poll.id}`)
        .setLabel(`${EMOJIS.ACTIONS.DELETE} End Poll`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!poll.isActive), // Disable if poll is already ended
    );

    components.push(managementRow);
    return components;
  }

  /**
   * Create results embed for ended polls
   */
  createResultsEmbed(poll) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.UI.PROGRESS} Poll Results: ${poll.question}`)
      .setColor(THEME.SUCCESS)
      .setTimestamp()
      .setFooter({
        text: `Poll ID: ${poll.id} • ${poll.allowMultiple ? "Multiple choice" : "Single choice"}`,
      });

    // Calculate vote counts
    const voteCounts = {};
    poll.options.forEach((option, index) => {
      voteCounts[index] = 0;
    });

    if (poll.votes) {
      Object.values(poll.votes).forEach(userVotes => {
        if (Array.isArray(userVotes)) {
          userVotes.forEach(optionIndex => {
            if (voteCounts[optionIndex] !== undefined) {
              voteCounts[optionIndex]++;
            }
          });
        }
      });
    }

    const totalVotes = Object.values(voteCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Add results
    poll.options.forEach((option, index) => {
      const votes = voteCounts[index] || 0;
      const percentage =
        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const emoji = this.getPollEmoji(index, poll.customEmojis);

      embed.addFields({
        name: `${emoji} ${option}`,
        value: `**${votes} votes** • ${percentage}%`,
        inline: true,
      });
    });

    embed.addFields({
      name: `${EMOJIS.UI.PROGRESS} Final Results`,
      value: `**Total Votes:** ${totalVotes}\n**Duration:** ${this.formatDuration(poll.duration)}\n**Status:** ${EMOJIS.STATUS.ERROR} Ended`,
      inline: false,
    });

    return embed;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(hours) {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else if (hours < 24) {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      if (minutes === 0) {
        return `${wholeHours} hour${wholeHours !== 1 ? "s" : ""}`;
      } else {
        return `${wholeHours}h ${minutes}m`;
      }
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? "s" : ""}`;
      } else {
        return `${days}d ${remainingHours}h`;
      }
    }
  }

  /**
   * Get emoji for poll option index
   */
  getPollEmoji(index, customEmojis = null) {
    if (customEmojis && customEmojis[index]) {
      return customEmojis[index];
    }
    const defaultEmojis = [
      EMOJIS.NUMBERS.ONE,
      EMOJIS.NUMBERS.TWO,
      EMOJIS.NUMBERS.THREE,
      EMOJIS.NUMBERS.FOUR,
      EMOJIS.NUMBERS.FIVE,
      EMOJIS.NUMBERS.SIX,
      EMOJIS.NUMBERS.SEVEN,
      EMOJIS.NUMBERS.EIGHT,
      EMOJIS.NUMBERS.NINE,
      EMOJIS.NUMBERS.TEN,
    ];
    return defaultEmojis[index] || EMOJIS.UI.QUESTION;
  }

  /**
   * Calculate remaining time for poll with real-time precision
   * This function calculates time dynamically when called, not based on server updates
   */
  calculateRemainingTime(poll) {
    const createdAt = new Date(poll.createdAt);
    const durationMs = poll.duration * 60 * 60 * 1000; // Convert hours to milliseconds
    const endTime = new Date(createdAt.getTime() + durationMs);
    const now = new Date();

    if (now >= endTime) {
      return "Poll ended";
    }

    const remainingMs = endTime.getTime() - now.getTime();
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor(
      (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
    );
    const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    // Show seconds for polls ending soon (less than 10 minutes)
    if (remainingMs <= 10 * 60 * 1000) {
      if (remainingMinutes > 0) {
        return `${remainingMinutes}m ${remainingSeconds}s left`;
      } else {
        return `${remainingSeconds}s left`;
      }
    }

    if (remainingHours > 0) {
      return `${remainingHours}h ${remainingMinutes}m left`;
    } else {
      return `${remainingMinutes}m left`;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      nextUpdate: this.updateInterval
        ? new Date(Date.now() + this.updateFrequency)
        : null,
    };
  }
}

export { PollScheduler };
