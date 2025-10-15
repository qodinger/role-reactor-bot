import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

const logger = getLogger();

// Use theme colors
const COLORS = {
  BLURPLE: THEME.PRIMARY,
  GRAY: THEME.TEXT_MUTED,
  DARK_GRAY: THEME.BACKGROUND,
};

// Poll constants
const POLL_CONSTANTS = {
  MAX_BUTTONS_PER_ROW: 5,
  MAX_OPTION_LENGTH: 20,
  TRUNCATED_LENGTH: 17,
};

/**
 * Handle poll button interactions
 * @param {import("discord.js").ButtonInteraction} interaction - The button interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollButton(interaction, _client) {
  try {
    // Defer the interaction immediately to prevent timeout
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const { customId } = interaction;

    // Parse custom ID using the new separator format
    let action, pollId, optionIndex;

    if (customId.startsWith("poll_vote-")) {
      const parts = customId.split("-");
      action = "poll_vote";
      pollId = parts.slice(1, -1).join("-"); // Everything between "poll" and the last part
      optionIndex = parts[parts.length - 1]; // Last part is the option index
    } else if (customId.startsWith("poll_results-")) {
      action = "poll_results";
      pollId = customId.replace("poll_results-", "");
    } else if (customId.startsWith("poll_refresh-")) {
      action = "poll_refresh";
      pollId = customId.replace("poll_refresh-", "");
    } else if (customId.startsWith("poll_end-")) {
      action = "poll_end";
      pollId = customId.replace("poll_end-", "");
    } else if (customId.startsWith("poll_delete-")) {
      action = "poll_delete";
      pollId = customId.replace("poll_delete-", "");
    } else {
      return; // Not a poll button
    }

    if (!action || !pollId) {
      return await interaction.editReply(
        errorEmbed({
          title: "Invalid Interaction",
          description: "Invalid poll button interaction.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    const storageManager = await getStorageManager();
    const poll = await storageManager.getPollById(pollId);

    if (!poll) {
      logger.warn(`Poll not found: ${pollId}`);
      return await interaction.editReply(
        errorEmbed({
          title: "Poll Not Found",
          description: "Poll not found or has expired.",
          solution: "The poll may have been deleted or is no longer available.",
        }),
      );
    }

    // Handle different button actions
    if (action === "poll_vote") {
      return await handleVoteButton(
        interaction,
        poll,
        optionIndex,
        storageManager,
      );
    } else if (action === "poll_results") {
      return await handleResultsButton(interaction, poll);
    } else if (action === "poll_refresh") {
      return await handleRefreshButton(interaction, poll);
    } else if (action === "poll_end") {
      return await handleEndPollButton(interaction, poll, storageManager);
    } else if (action === "poll_delete") {
      return await handleDeleteButton(interaction, poll, storageManager);
    }
  } catch (error) {
    logger.error("Error handling poll button interaction", error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Button Interaction Failed",
          description: "An error occurred while processing your request.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Button Interaction Failed",
          description: "An error occurred while processing your request.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}

/**
 * Handle vote button
 */
async function handleVoteButton(
  interaction,
  poll,
  optionIndex,
  storageManager,
) {
  const optionIdx = parseInt(optionIndex);
  const option = poll.options[optionIdx];
  const userId = interaction.user.id;

  // Check if poll is still active
  if (!poll.isActive) {
    return await interaction.editReply(
      errorEmbed({
        title: "Poll Ended",
        description: "This poll has ended and no longer accepts votes.",
        solution: "The poll duration has expired or it was manually ended.",
      }),
    );
  }

  // Check if poll has expired by time
  const now = new Date();
  const createdAt = new Date(poll.createdAt);
  const durationMs = poll.duration * 60 * 60 * 1000;
  const endTime = new Date(createdAt.getTime() + durationMs);

  if (now >= endTime) {
    // Poll has expired, end it immediately
    poll.isActive = false;
    poll.endedAt = new Date().toISOString();
    poll.status = "ended";

    // Update poll in storage
    await storageManager.updatePoll(poll.id, poll);

    // Update the poll message to show it's ended
    await updatePollMessage(interaction, poll);

    // Send notification that poll has ended
    await notifyPollEnded(interaction, poll);

    return await interaction.editReply(
      errorEmbed({
        title: "Poll Expired",
        description: "This poll has expired and no longer accepts votes.",
        solution: "The poll duration has ended. Check the poll results above.",
      }),
    );
  }

  // Initialize poll data if needed
  if (!poll.votes) {
    poll.votes = {};
  }
  if (!poll.votes[userId]) {
    poll.votes[userId] = [];
  }

  // Check if user already voted for this option
  const hasVoted = poll.votes[userId].includes(optionIdx);

  if (hasVoted) {
    // Remove vote
    poll.votes[userId] = poll.votes[userId].filter(idx => idx !== optionIdx);
    logger.info(
      `${EMOJIS.STATUS.SUCCESS} Vote removed: ${interaction.user.tag} removed vote for "${option}" in poll ${poll.id}`,
    );
  } else {
    // Check if multiple voting is allowed
    if (!poll.allowMultiple && poll.votes[userId].length > 0) {
      // Remove previous votes
      poll.votes[userId] = [];
    }

    // Add vote
    poll.votes[userId].push(optionIdx);
    logger.info(
      `${EMOJIS.STATUS.SUCCESS} Vote added: ${interaction.user.tag} voted for "${option}" in poll ${poll.id}`,
    );
  }

  // Update poll data
  await storageManager.updatePoll(poll.id, poll);

  // Update the poll message with visual feedback
  await updatePollMessage(interaction, poll);

  await interaction.editReply({
    content: null,
  });
}

/**
 * Handle results button
 */
async function handleResultsButton(interaction, poll) {
  const resultsEmbed = createResultsEmbed(poll);

  await interaction.editReply({
    embeds: [resultsEmbed],
  });
}

/**
 * Handle refresh button
 */
async function handleRefreshButton(interaction, poll) {
  await updatePollMessage(interaction, poll);

  await interaction.editReply({
    content: null,
  });
}

/**
 * Handle delete button
 */
async function handleDeleteButton(interaction, poll, storageManager) {
  // Check permissions
  const isCreator = poll.creatorId === interaction.user.id;
  const isAdmin =
    interaction.member &&
    interaction.member.permissions &&
    interaction.member.permissions.has("ManageMessages");

  if (!isCreator && !isAdmin) {
    return await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} You can only delete polls you created or if you have Manage Messages permission.`,
    });
  }

  // Delete poll message
  try {
    await interaction.message.delete();
  } catch (error) {
    logger.warn(`Could not delete poll message ${poll.messageId}`, error);
  }

  // Remove from storage
  await storageManager.deletePoll(poll.id);

  logger.info(
    `${EMOJIS.STATUS.SUCCESS} Poll deleted: ${poll.id} by ${interaction.user.tag}`,
  );
}

/**
 * Handle end poll button
 */
async function handleEndPollButton(interaction, poll, storageManager) {
  // Check permissions
  const isCreator = poll.creatorId === interaction.user.id;
  const isAdmin =
    interaction.member &&
    interaction.member.permissions &&
    interaction.member.permissions.has("ManageMessages");

  if (!isCreator && !isAdmin) {
    return await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} You don't have permission to end this poll. Only the creator or users with Manage Messages permission can end polls.`,
    });
  }

  // Mark poll as ended
  poll.isActive = false;
  poll.endedAt = new Date().toISOString();
  await storageManager.updatePoll(poll.id, poll);

  // Update the poll message to show it's ended
  await updatePollMessage(interaction, poll);

  await interaction.editReply({
    content: null,
  });
}

/**
 * Update poll message with current results
 */
async function updatePollMessage(interaction, poll) {
  const pollEmbed = createUpdatedPollEmbed(poll);
  const updatedComponents = createUpdatedComponents(poll, interaction.user.id);

  try {
    await interaction.message.edit({
      embeds: [pollEmbed],
      components: updatedComponents,
    });
  } catch (error) {
    logger.error("Error updating poll message", error);
  }
}

/**
 * Create updated components with visual feedback for selected options
 */
function createUpdatedComponents(poll, userId = null) {
  const components = [];
  const maxButtonsPerRow = POLL_CONSTANTS.MAX_BUTTONS_PER_ROW;

  // Create voting buttons
  for (let i = 0; i < poll.options.length; i += maxButtonsPerRow) {
    const row = new ActionRowBuilder();

    for (
      let j = i;
      j < Math.min(i + maxButtonsPerRow, poll.options.length);
      j++
    ) {
      const option = poll.options[j];
      const emoji = getPollEmoji(j);

      // Check if this option is selected by the current user
      let isSelected = false;
      if (poll.votes && userId && poll.votes[userId]) {
        if (Array.isArray(poll.votes[userId])) {
          isSelected = poll.votes[userId].includes(j);
        } else {
          // Handle old format
          isSelected = poll.votes[userId][option] || false;
        }
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote-${poll.id}-${j}`)
          .setLabel(
            option.length > POLL_CONSTANTS.MAX_OPTION_LENGTH
              ? `${option.substring(0, POLL_CONSTANTS.TRUNCATED_LENGTH)}...`
              : option,
          )
          .setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary)
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
 * Create poll embed with current results (beautiful Discord poll style)
 */
function createUpdatedPollEmbed(poll) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.UI.PROGRESS} ${poll.question}`)
    .setDescription(
      `Select ${poll.allowMultiple ? "one or more answers" : "one answer"} by clicking the buttons below`,
    )
    .setColor(poll.isActive ? COLORS.BLURPLE : COLORS.GRAY)
    .setTimestamp()
    .setFooter({
      text: `Poll ID: ${poll.id} • Duration: ${poll.duration}h • ${poll.allowMultiple ? "Multiple choice" : "Single choice"}`,
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
      } else {
        // Handle old format
        Object.keys(userVotes).forEach(option => {
          const optionIndex = poll.options.indexOf(option);
          if (optionIndex !== -1 && userVotes[option]) {
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
    const emoji = getPollEmoji(index);

    embed.addFields({
      name: `${emoji} ${option}`,
      value: `**${votes} votes** • ${percentage}%`,
      inline: true,
    });
  });

  // Add poll status
  const remainingTime = calculateRemainingTime(poll);
  const status = poll.isActive
    ? `${EMOJIS.STATUS.SUCCESS} Active`
    : `${EMOJIS.STATUS.ERROR} Ended`;
  embed.addFields({
    name: `${EMOJIS.UI.PROGRESS} Poll Status`,
    value: `**Total Votes:** ${totalVotes}\n**Time Remaining:** ${remainingTime}\n**Status:** ${status}`,
    inline: false,
  });

  return embed;
}

/**
 * Get emoji for poll option index
 * @param {number} index - The option index
 * @returns {string} The emoji
 */
function getPollEmoji(index) {
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
 * This function calculates time dynamically when called, providing real-time countdown
 */
function calculateRemainingTime(poll) {
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
 * Notify that a poll has ended
 */
async function notifyPollEnded(interaction, poll) {
  try {
    const channel = interaction.channel;
    if (!channel) return;

    const resultsEmbed = createResultsEmbed(poll);

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
    logger.error(`Error sending poll end notification for ${poll.id}:`, error);
  }
}

/**
 * Create results embed
 */
function createResultsEmbed(poll) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.UI.PROGRESS} Poll Results: ${poll.question}`)
    .setColor(THEME.SUCCESS)
    .setTimestamp();

  // Calculate vote counts and percentages
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
    const emoji = getDefaultEmoji(index);
    const votes = voteCounts[index] || 0;
    const percentage =
      totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const progressBar = createProgressBar(percentage);

    embed.addFields({
      name: `${emoji} ${option}`,
      value: `${progressBar} **${votes}** votes (${percentage}%)`,
      inline: false,
    });
  });

  embed.addFields({
    name: "Total Votes",
    value: totalVotes.toString(),
    inline: true,
  });

  return embed;
}

/**
 * Create progress bar
 */
function createProgressBar(percentage) {
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;
  const filledBar = "█".repeat(filled);
  const emptyBar = "░".repeat(empty);
  return `\`${filledBar}${emptyBar}\``;
}

/**
 * Get default emoji for index
 */
function getDefaultEmoji(index) {
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
 * Handle poll list button interactions (pagination, quick actions)
 * @param {import("discord.js").ButtonInteraction} interaction - The button interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollListButton(interaction, _client) {
  try {
    // Defer the interaction immediately to prevent timeout
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const { customId } = interaction;

    if (customId.startsWith("poll_list_page_")) {
      // Handle pagination
      const page = parseInt(customId.split("_")[3]);
      const { handlePollList } = await import("./handlers.js");

      // Create a mock interaction with the page option
      const mockInteraction = {
        ...interaction,
        options: {
          getInteger: name => (name === "page" ? page : null),
        },
      };

      await handlePollList(mockInteraction, _client);
      return;
    }

    // Refresh button removed - not needed with native polls

    if (customId === "poll_create_quick") {
      // Handle quick poll creation - redirect to poll create command
      await interaction.editReply({
        content: `🚀 **Quick Poll Creation**\n\nUse \`/poll create\` to create a new poll!\n\n**Example:**\n\`/poll create question:"What's your favorite color?" options:"Red,Blue,Green" duration:24\``,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Unknown poll list button
    await interaction.editReply(
      errorEmbed({
        title: "Unknown Action",
        description: "Unknown poll list action.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  } catch (error) {
    logger.error("Error handling poll list button interaction", error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Button Interaction Failed",
          description: "An error occurred while processing your request.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Button Interaction Failed",
          description: "An error occurred while processing your request.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}
