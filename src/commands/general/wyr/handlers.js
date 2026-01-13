import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { createWYREmbed, createErrorEmbed } from "./embeds.js";
import { getRandomWYRQuestion } from "./utils.js";
import { EMOJIS } from "../../../config/theme.js";

const logger = getLogger();

// In-memory storage for WYR votes
// Structure: Map<messageId, { question: string, votes: Map<userId, 1|2>, createdAt: number }>
const wyrVotes = new Map();

// Cleanup old votes after 24 hours
const VOTE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Periodic cleanup interval: 1 hour (cleanup runs every hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Track cleanup interval to prevent multiple intervals
let cleanupInterval = null;

/**
 * Clean up expired votes
 * Called periodically and when accessing vote data
 */
function cleanupExpiredVotes() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [messageId, voteData] of wyrVotes.entries()) {
    if (now - voteData.createdAt > VOTE_EXPIRY_TIME) {
      wyrVotes.delete(messageId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug(`Cleaned up ${cleanedCount} expired WYR vote(s)`);
  }
}

/**
 * Start periodic cleanup of expired votes
 * This prevents memory leaks if votes are not accessed frequently
 */
function startPeriodicCleanup() {
  // Start cleanup interval if not already running
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    cleanupExpiredVotes();
  }, CLEANUP_INTERVAL_MS);

  logger.debug("Started periodic WYR vote cleanup");
}

/**
 * Stop periodic cleanup (for testing or shutdown)
 */
export function stopPeriodicCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug("Stopped periodic WYR vote cleanup");
  }
}

// Start periodic cleanup when module loads
startPeriodicCleanup();

/**
 * Get vote data for a message
 * @param {string} messageId - Message ID
 * @returns {Object|null} Vote data or null
 */
function getVoteData(messageId) {
  cleanupExpiredVotes();
  return wyrVotes.get(messageId) || null;
}

/**
 * Set vote data for a message
 * @param {string} messageId - Message ID
 * @param {string} question - The question
 * @param {string} requesterId - User ID who requested the question
 */
function setVoteData(messageId, question, requesterId) {
  wyrVotes.set(messageId, {
    question,
    votes: new Map(),
    createdAt: Date.now(),
    requesterId,
  });
}

/**
 * Get vote counts for a message
 * @param {string} messageId - Message ID
 * @returns {Object} Vote counts { option1: number, option2: number, total: number }
 */
function getVoteCounts(messageId) {
  const voteData = getVoteData(messageId);
  if (!voteData) {
    return { option1: 0, option2: 0, total: 0 };
  }

  let option1 = 0;
  let option2 = 0;

  for (const choice of voteData.votes.values()) {
    if (choice === 1) option1++;
    if (choice === 2) option2++;
  }

  return {
    option1,
    option2,
    total: option1 + option2,
  };
}

/**
 * Create action row with voting buttons
 * @param {string|null} messageId - Message ID to check user's vote and requester
 * @param {string|null} userId - User ID to check their vote
 * @param {string|null} requesterId - Original requester ID (optional, will be fetched if not provided)
 * @returns {ActionRowBuilder}
 */
function createVoteButtons(
  _messageId = null,
  _userId = null,
  _requesterId = null,
) {
  // Always keep the refresh button enabled
  // The permission check in handleWYRButton (line 177) prevents unauthorized use.
  // This allows the requester to refresh multiple times while still blocking others.
  const canRefresh = true;

  // Buttons are always blue - vote information is shown in the embed
  // We can't show different button states to different users (Discord limitation)
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("wyr_vote_1")
      .setLabel("Option 1")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EMOJIS.NUMBERS.ONE),
    new ButtonBuilder()
      .setCustomId("wyr_vote_2")
      .setLabel("Option 2")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EMOJIS.NUMBERS.TWO),
    new ButtonBuilder()
      .setCustomId("wyr_new_question")
      .setLabel("New Question")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.REFRESH)
      .setDisabled(!canRefresh), // Disable for non-requesters, but always show it
  );
}

export async function execute(interaction, _client) {
  try {
    await interaction.deferReply({ ephemeral: false });

    // Get category from interaction options if provided
    const category = interaction.options.getString("category") || null;

    const question = getRandomWYRQuestion(category);

    // Handle case where questions file failed to load
    if (!question) {
      logger.error(
        "Failed to get WYR question - questions file may not be loaded",
      );
      await interaction.editReply({ embeds: [createErrorEmbed()] });
      return;
    }

    const embed = createWYREmbed(question, interaction.user, {
      option1: 0,
      option2: 0,
      total: 0,
    });

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [createVoteButtons()],
    });

    // Store vote data for this message
    setVoteData(reply.id, question, interaction.user.id);
  } catch (error) {
    logger.error("Error in wyr command:", error);
    await interaction.editReply({ embeds: [createErrorEmbed()] });
  }
}

/**
 * Handle WYR button interactions
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction
 * @param {import('discord.js').Client} _client - Discord client
 */
export async function handleWYRButton(interaction, _client) {
  try {
    const { customId, message } = interaction;
    const messageId = message.id;

    // Handle new question button
    if (customId === "wyr_new_question") {
      // Check if user is the original requester
      const voteData = getVoteData(messageId);
      if (voteData && voteData.requesterId !== interaction.user.id) {
        await interaction.reply({
          content:
            "Only the person who requested this question can refresh it.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferUpdate();

      // Get original requester from embed footer or vote data
      const originalRequesterId = voteData?.requesterId || interaction.user.id;
      let originalRequester = interaction.user;

      // Try to get the original requester user object
      try {
        originalRequester =
          await interaction.client.users.fetch(originalRequesterId);
      } catch (_error) {
        // Fallback to current user if fetch fails
        logger.debug("Could not fetch original requester, using current user");
      }

      // Get a new random question (no category filter for button refresh)
      const question = getRandomWYRQuestion();

      // Handle case where questions file failed to load
      if (!question) {
        logger.error(
          "Failed to get WYR question - questions file may not be loaded",
        );
        await interaction.editReply({
          embeds: [createErrorEmbed()],
          components: [createVoteButtons(messageId, originalRequesterId)],
        });
        return;
      }

      const embed = createWYREmbed(question, originalRequester, {
        option1: 0,
        option2: 0,
        total: 0,
      });

      // Update vote data for this message (keep original requester)
      setVoteData(messageId, question, originalRequesterId);

      // Show refresh button to the original requester
      await interaction.editReply({
        embeds: [embed],
        components: [createVoteButtons(messageId, originalRequesterId)],
      });
      return;
    }

    // Handle vote buttons
    if (customId === "wyr_vote_1" || customId === "wyr_vote_2") {
      const choice = customId === "wyr_vote_1" ? 1 : 2;
      const voteData = getVoteData(messageId);

      if (!voteData) {
        await interaction.reply({
          content:
            "This question has expired. Please use `/wyr` to get a new one.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const userId = interaction.user.id;
      const currentVote = voteData.votes.get(userId);

      // Toggle vote: if user already voted for this option, remove vote; otherwise, set vote
      if (currentVote === choice) {
        voteData.votes.delete(userId);
      } else {
        voteData.votes.set(userId, choice);
      }

      // Get updated vote counts
      const voteCounts = getVoteCounts(messageId);

      // Update embed with new vote counts
      const embed = createWYREmbed(
        voteData.question,
        interaction.user,
        voteCounts,
      );

      await interaction.deferUpdate();

      const requesterId = voteData.requesterId;

      await interaction.editReply({
        embeds: [embed],
        components: [createVoteButtons(messageId, null, requesterId)],
      });
      return;
    }
  } catch (error) {
    logger.error("Error handling WYR button:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your vote.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
