import {
  PermissionFlagsBits,
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
import { parsePollOptions } from "./utils.js";
import {
  createPollCreationModal,
  createPollCreationMenu,
  createPollCreationMenuWithSelections,
} from "./modals.js";

const logger = getLogger();

/**
 * Handle poll ending by poll owners
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction
 * @param {import('discord.js').Client} client - The Discord client
 */
export async function handlePollEnd(interaction, client, _deferred = false) {
  try {
    // Get command options
    const pollId = interaction.options.getString("poll-id");

    // Get storage manager
    const storageManager = await getStorageManager();
    const poll = await storageManager.getPollById(pollId);

    // Check if poll exists
    if (!poll) {
      return await interaction.editReply(
        errorEmbed({
          title: "Poll Not Found",
          description: `No poll found with ID: \`${pollId}\``,
          solution: "Use `/poll list` to see available polls and their IDs.",
        }),
      );
    }

    // Check if user owns this poll or has admin permissions
    if (
      poll.creatorId !== interaction.user.id &&
      (!interaction.member ||
        !interaction.member.permissions ||
        !interaction.member.permissions.has("Administrator"))
    ) {
      return await interaction.editReply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You can only end polls that you created or have Administrator permissions.",
          solution: "Only the poll creator or administrators can end polls.",
        }),
      );
    }

    // Check if poll is still active
    if (!poll.isActive) {
      return await interaction.editReply(
        errorEmbed({
          title: "Poll Not Active",
          description: "This poll is no longer active and cannot be ended.",
          solution: "Only active polls can be ended.",
        }),
      );
    }

    // Get the poll message and end it using Discord's native API
    const channel = await client.channels.fetch(poll.channelId);
    const message = await channel.messages.fetch(poll.messageId);

    if (!message.poll) {
      return await interaction.editReply(
        errorEmbed({
          title: "Invalid Poll",
          description: "This message is not a valid poll.",
          solution: "Make sure the poll ID is correct.",
        }),
      );
    }

    // End the poll using Discord's native end() method
    await message.poll.end();

    // Update poll status in database
    const updatedPoll = {
      ...poll,
      isActive: false,
      endedAt: new Date().toISOString(),
      endedBy: interaction.user.id,
    };

    await storageManager.updatePoll(pollId, updatedPoll);

    await interaction.editReply({
      content: `**Poll Ended Successfully!**\n\nThe poll has been ended early and results are now final.`,
    });

    logger.info(`Poll ended: ${pollId} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error("Error in handlePollEnd:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to end poll.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

// Poll constants
const POLL_CONSTANTS = {
  MAX_OPTIONS: 10,
  POLLS_PER_PAGE: 6,
};

/**
 * Create poll from validated data (reusable function)
 * @param {import("discord.js").Interaction} interaction - The interaction object
 * @param {Object} pollData - Poll data object
 */
async function createPollFromData(interaction, pollData) {
  const { question, options, duration, allowMultiple, startTime } = pollData;

  // Try to create native Discord poll using REST API directly
  let pollMessage;

  try {
    // Create native Discord poll
    pollMessage = await interaction.channel.send({
      poll: {
        question: {
          text: question,
        },
        answers: options.map((option, _index) => {
          // Extract emoji from option text (if present)
          const emojiMatch = option.match(
            /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF})/u,
          );
          const emoji = emojiMatch ? emojiMatch[1] : null;

          // Remove emoji from text if found
          const text = emoji ? option.replace(emoji, "").trim() : option;

          return {
            text,
            emoji: emoji || null, // Only use emoji if user provided one
          };
        }),
        duration: Math.max(1, duration), // Duration in hours (minimum 1 hour)
        allowMultiselect: allowMultiple,
      },
    });

    // Send confirmation to the user who created the poll
    await interaction.editReply({
      content: `**Poll Created Successfully!**\nThe poll has been posted in this channel for everyone to vote.`,
      flags: MessageFlags.Ephemeral,
    });

    logger.info(`Native Discord poll created successfully: ${pollMessage.id}`);
  } catch (pollError) {
    logger.error("Native poll creation failed:", pollError);
    return await interaction.editReply(
      errorEmbed({
        title: "Poll Creation Failed",
        description: "Unable to create poll. Please try again later.",
      }),
    );
  }

  // Store basic poll metadata for management
  const storageManager = await getStorageManager();

  const pollId = pollMessage.id;

  const pollDataToStore = {
    id: pollId,
    messageId: pollMessage.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    creatorId: interaction.user.id,
    question,
    options,
    allowMultiple,
    duration,
    createdAt: new Date().toISOString(),
    isActive: true,
    creatorName: interaction.user.displayName,
  };

  await storageManager.createPoll(pollDataToStore);

  const executionTime = Date.now() - startTime;
  logger.info(
    `Poll created: ${pollId} by ${interaction.user.tag} (${executionTime}ms)`,
  );
}

const pollSelections = new Map();

/**
 * Handle poll creation modal display
 * @param {import("discord.js").CommandInteraction} interaction - The interaction object
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollCreateModal(
  interaction,
  _client,
  deferred = false,
) {
  try {
    const { embed, components } = createPollCreationMenu(_client);

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error showing poll creation menu", error);

    // Only try to reply if we haven't already responded
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply(
          errorEmbed({
            title: "Menu Display Failed",
            description: "Failed to show the poll creation menu.",
            solution:
              "Please try again or contact support if the issue persists.",
          }),
          { flags: MessageFlags.Ephemeral },
        );
      } catch (replyError) {
        logger.error("Failed to send error reply", replyError);
      }
    } else {
      // If already deferred, use editReply
      try {
        await interaction.editReply(
          errorEmbed({
            title: "Menu Display Failed",
            description: "Failed to show the poll creation menu.",
            solution:
              "Please try again or contact support if the issue persists.",
          }),
        );
      } catch (editError) {
        logger.error("Failed to send error editReply", editError);
      }
    }
  }
}

/**
 * Handle poll creation selection menu interactions
 * @param {import("discord.js").StringSelectMenuInteraction} interaction - The select menu interaction
 * @param {import("discord.js").Client} client - The Discord client
 */
export async function handlePollCreationSelect(interaction, client) {
  try {
    // Check if interaction is already acknowledged
    if (interaction.replied || interaction.deferred) {
      logger.warn(
        "Poll creation select interaction already acknowledged, skipping",
      );
      return;
    }

    const { customId, values } = interaction;

    if (customId === "poll_duration_select") {
      // Store duration selection and update UI
      const duration = parseFloat(values[0]);

      // Store selection and acknowledge immediately
      const userId = interaction.user.id;
      const currentSelections = pollSelections.get(userId) || {};
      pollSelections.set(userId, { ...currentSelections, duration });

      // Acknowledge the interaction immediately to prevent timeout
      await interaction.deferUpdate();

      // Update the UI in the background
      await updatePollCreationMenu(interaction, { duration }, client);
    } else if (customId === "poll_multiple_choice_select") {
      // Store multiple choice selection and update UI
      const allowMultiple = values[0] === "true";

      // Store selection and acknowledge immediately
      const userId = interaction.user.id;
      const currentSelections = pollSelections.get(userId) || {};
      pollSelections.set(userId, { ...currentSelections, allowMultiple });

      // Acknowledge the interaction immediately to prevent timeout
      await interaction.deferUpdate();

      // Update the UI in the background
      await updatePollCreationMenu(interaction, { allowMultiple }, client);
    }
  } catch (error) {
    logger.error("Error handling poll creation select", error);

    // Only try to reply if we haven't already responded
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply(
          errorEmbed({
            title: "Selection Failed",
            description: "Failed to process your selection.",
            solution:
              "Please try again or contact support if the issue persists.",
          }),
          { flags: MessageFlags.Ephemeral },
        );
      } catch (replyError) {
        logger.error("Failed to send error reply", replyError);
      }
    }
  }
}

/**
 * Handle poll creation button interactions
 * @param {import("discord.js").ButtonInteraction} interaction - The button interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollCreationButton(interaction, _client) {
  try {
    const { customId } = interaction;

    if (customId === "poll_continue_to_modal") {
      // Get stored selections and show the modal
      const selections = getPollSelections(interaction.user.id);

      if (!selections.duration || selections.allowMultiple === undefined) {
        return await interaction.reply(
          errorEmbed({
            title: "Missing Settings",
            description:
              "Please select both duration and vote type before continuing.",
            solution: "Use the dropdowns above to make your selections first.",
          }),
          { flags: MessageFlags.Ephemeral },
        );
      }

      const modal = createPollCreationModal();
      await interaction.showModal(modal);
    } else if (customId === "poll_cancel_creation") {
      await interaction.deferUpdate();
      await interaction.editReply({
        content: `Poll creation cancelled.`,
        embeds: [],
        components: [],
      });
    }
  } catch (error) {
    logger.error("Error handling poll creation button", error);

    // Only try to reply if we haven't already responded
    if (!interaction.replied || !interaction.deferred) {
      try {
        await interaction.reply(
          errorEmbed({
            title: "Button Action Failed",
            description: "Failed to process your button click.",
            solution:
              "Please try again or contact support if the issue persists.",
          }),
          { flags: MessageFlags.Ephemeral },
        );
      } catch (replyError) {
        logger.error("Failed to send error reply", replyError);
      }
    }
  }
}

/**
 * Update poll creation menu with selections
 * @param {import("discord.js").Interaction} interaction - The interaction
 * @param {Object} selections - Current selections
 * @param {import("discord.js").Client} client - The Discord client
 */
async function updatePollCreationMenu(interaction, selections, client) {
  const userId = interaction.user.id;

  // Store or update selections for this user
  const currentSelections = pollSelections.get(userId) || {};
  const updatedSelections = { ...currentSelections, ...selections };
  pollSelections.set(userId, updatedSelections);

  // Create updated menu with selections
  const { embed, components } = createPollCreationMenuWithSelections(
    updatedSelections,
    interaction,
    client,
  );

  // Enable continue button if both selections are made
  if (
    updatedSelections.duration &&
    updatedSelections.allowMultiple !== undefined
  ) {
    components[2].components[0].setDisabled(false); // Enable continue button
  }

  await interaction.editReply({
    embeds: [embed],
    components,
  });
}

/**
 * Get stored selections for a user
 * @param {string} userId - The user ID
 * @returns {Object} The stored selections
 */
function getPollSelections(userId) {
  return pollSelections.get(userId) || {};
}

/**
 * Clear stored selections for a user
 * @param {string} userId - The user ID
 */
function clearPollSelections(userId) {
  pollSelections.delete(userId);
}

/**
 * Handle poll creation from modal submission
 * @param {import("discord.js").ModalSubmitInteraction} interaction - The modal interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollCreateFromModal(interaction, _client) {
  const startTime = Date.now();

  try {
    // Defer the interaction first
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // No rate limiting - Discord doesn't limit poll creation
    // Let users create as many polls as they want, just like native Discord polls

    const question = interaction.fields.getTextInputValue("poll_question");
    const optionsString = interaction.fields.getTextInputValue("poll_options");

    // Get duration and multiple choice from stored selections
    const userId = interaction.user.id;
    const selections = getPollSelections(userId);

    if (!selections.duration || selections.allowMultiple === undefined) {
      logger.warn(`Missing selections for user ${userId}:`, selections);
      return await interaction.editReply(
        errorEmbed({
          title: "Poll Creation Failed",
          description:
            "Missing poll settings. Please go back and select duration and vote type.",
          solution: "Use the poll creation menu to select your settings first.",
        }),
      );
    }

    const duration = selections.duration;
    const allowMultiple = selections.allowMultiple;

    // Parse options using the utility function
    const options = parsePollOptions(optionsString);

    if (options.length < 2) {
      return await interaction.editReply(
        errorEmbed({
          title: "Invalid Options",
          description: "Please provide at least 2 options separated by |",
          solution: "Example: Option 1|Option 2|Option 3",
        }),
      );
    }

    if (options.length > 10) {
      return await interaction.editReply(
        errorEmbed({
          title: "Too Many Options",
          description: "Please provide at most 10 options",
          solution: "Reduce the number of options",
        }),
      );
    }

    // Validate question length (Discord API limit: 300 characters)
    if (question.length > 300) {
      return await interaction.editReply(
        errorEmbed({
          title: "Question Too Long",
          description: "Poll question cannot exceed 300 characters.",
          solution: `Please shorten your question. Current length: ${question.length}/300 characters.`,
        }),
      );
    }

    // Validate answer text length (Discord API limit: 55 characters per answer)
    const invalidOptions = options.filter(option => option.length > 55);
    if (invalidOptions.length > 0) {
      return await interaction.editReply(
        errorEmbed({
          title: "Answer Too Long",
          description: `Poll answers cannot exceed 55 characters each.`,
          solution: `Please shorten these answers: ${invalidOptions.map(opt => `"${opt}"`).join(", ")}`,
        }),
      );
    }

    // Use default number emojis
    const numberEmojis = [
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

    const emojis = options.map(
      (_, index) => numberEmojis[index] || `**${index + 1}**`,
    );

    // Create the poll using the reusable function
    await createPollFromData(interaction, {
      question,
      options,
      duration,
      allowMultiple,
      customEmojis: emojis,
      startTime,
    });

    // Clear the stored selections after successful poll creation
    clearPollSelections(userId);
  } catch (error) {
    logger.error("Error creating poll from modal", error);
    await interaction.editReply(
      errorEmbed({
        title: "Poll Creation Failed",
        description: "An error occurred while creating the poll.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Create a poll card for display in the poll list
 * @param {import("discord.js").CommandInteraction} interaction - The interaction object
 * @param {Object} poll - The poll object
 * @param {number} pollNumber - The poll number for display
 * @returns {Promise<string>} The formatted poll card
 */
async function createPollCard(interaction, poll, pollNumber) {
  const creator = await interaction.guild.members
    .fetch(poll.creatorId)
    .catch(() => null);
  const creatorName = creator ? creator.displayName : "Unknown User";

  // Calculate remaining time and status
  const createdAt = new Date(poll.createdAt);
  const durationMs = poll.duration * 60 * 60 * 1000; // Convert hours to milliseconds
  const endTime = new Date(createdAt.getTime() + durationMs);
  const now = new Date();
  const remainingMs = endTime.getTime() - now.getTime();

  let timeRemaining;
  let statusColor;

  // Only two states: Active or Ended
  if (!poll.isActive || remainingMs <= 0) {
    timeRemaining = "Ended";
    statusColor = `\`${EMOJIS.STATUS.OFFLINE}\``;
  } else {
    // Poll is still active
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor(
      (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
    );
    timeRemaining =
      remainingHours > 0
        ? `${remainingHours}h ${remainingMinutes}m`
        : `${remainingMinutes}m`;
    statusColor = `\`${EMOJIS.STATUS.ONLINE}\``;
  }

  // Create compact poll card for 2-column layout
  const pollNumberStr = `${pollNumber}`.padStart(2, "0");
  const typeIcon = poll.allowMultiple
    ? EMOJIS.UI.MULTIPLE_CHOICE
    : EMOJIS.UI.SINGLE_CHOICE;
  const typeText = poll.allowMultiple ? "Multiple" : "Single";

  // Format duration nicely
  const durationText =
    poll.duration >= 24
      ? `${Math.floor(poll.duration / 24)}d ${poll.duration % 24}h`
      : `${poll.duration}h`;

  // Truncate question if too long for 2-column layout
  const maxQuestionLength = 30;
  const truncatedQuestion =
    poll.question.length > maxQuestionLength
      ? `${poll.question.substring(0, maxQuestionLength)}...`
      : poll.question;

  // Create compact poll card content
  const pollCard = [
    `**${pollNumberStr}.** ${truncatedQuestion}`,
    ``,
    `${statusColor} **Status:** ${timeRemaining}`,
    `**ID:** \`${poll.id}\``,
    `**Creator:** ${creatorName}`,
    `**Duration:** ${durationText}`,
    `${typeIcon} **Type:** ${typeText}`,
    `**Options:** ${poll.options.length}`,
    ``,
    `[View Poll](https://discord.com/channels/${interaction.guild.id}/${poll.channelId}/${poll.messageId})`,
  ].join("\n");

  return pollCard;
}

/**
 * Handle poll listing with beautiful embed design
 * @param {import("discord.js").CommandInteraction} interaction - The interaction object
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollList(interaction, _client, _deferred = false) {
  const startTime = Date.now();

  try {
    const page = interaction.options.getInteger("page") || 1;
    const showEnded = interaction.options.getBoolean("show-ended") || false;

    // Quick timeout check - if we're already slow, send a simple response
    const initialTime = Date.now() - startTime;
    if (initialTime > 2000) {
      logger.warn(
        `[PollList] Already slow at start (${initialTime}ms), sending quick response`,
      );
      return await interaction.editReply({
        content: `**No Polls Found**\n\nThere are currently no polls in this server.\nCreate a new poll using \`/poll create\` to get started!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const storageManager = await getStorageManager();
    const guildPolls = await storageManager.getPollsByGuild(
      interaction.guild.id,
    );

    // Filter polls based on show-ended option
    const allPolls = Object.values(guildPolls);

    // Calculate which polls are actually active and update expired polls
    const now = new Date();
    const pollsToUpdate = [];

    const activePolls = allPolls.filter(poll => {
      const createdAt = new Date(poll.createdAt);
      const durationMs = poll.duration * 60 * 60 * 1000;
      const endTime = new Date(createdAt.getTime() + durationMs);
      const remainingMs = endTime.getTime() - now.getTime();

      // If poll is marked as active but time has expired, mark it for update
      if (poll.isActive && remainingMs <= 0) {
        pollsToUpdate.push({
          ...poll,
          isActive: false,
          endedAt: new Date().toISOString(),
          endedBy: "system",
        });
        return false; // Don't include in active polls
      }

      return poll.isActive && remainingMs > 0;
    });

    const endedPolls = allPolls.filter(poll => {
      const createdAt = new Date(poll.createdAt);
      const durationMs = poll.duration * 60 * 60 * 1000;
      const endTime = new Date(createdAt.getTime() + durationMs);
      const remainingMs = endTime.getTime() - now.getTime();

      return !poll.isActive || remainingMs <= 0;
    });

    // Update expired polls in the background
    if (pollsToUpdate.length > 0) {
      Promise.all(
        pollsToUpdate.map(poll => storageManager.updatePoll(poll.id, poll)),
      )
        .then(() => {
          logger.info(`Updated ${pollsToUpdate.length} expired polls`);
        })
        .catch(error => {
          logger.error("Failed to update expired polls:", error);
        });
    }

    // Determine which polls to show
    const pollsToShow = showEnded ? allPolls : activePolls;

    if (pollsToShow.length === 0) {
      const title = showEnded ? `Polls` : `Active Polls`;
      const description = showEnded
        ? `**No polls found in this server.**\n\nCreate your first poll using \`/poll create\` to get started!`
        : `**No active polls found.**\n\nCreate a new poll using \`/poll create\` to get started!`;

      const emptyEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(THEME.TEXT_MUTED)
        .addFields({
          name: `Quick Start`,
          value:
            "• Use `/poll create` to create a new poll\n• Set duration from 1 hour to 7 days\n• Choose single or multiple choice voting\n• Add emojis to make polls more engaging",
          inline: false,
        })
        .setFooter({
          text: `${interaction.guild.name} • Poll System`,
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        })
        .setTimestamp();

      // Check if we're approaching the 3-second timeout
      const totalTime = Date.now() - startTime;
      if (totalTime > 2500) {
        logger.warn(
          `[PollList] Approaching timeout (${totalTime}ms), sending quick reply`,
        );
        try {
          const result = await interaction.editReply({
            content: `**No Active Polls Found**\n\nThere are currently no active polls in this server.\nCreate a new poll using \`/poll create\` to get started!`,
            flags: MessageFlags.Ephemeral,
          });
          return result;
        } catch (error) {
          logger.error(`[PollList] Quick reply failed:`, error);
          throw error;
        }
      }

      try {
        const result = await interaction.editReply({
          embeds: [emptyEmbed],
          flags: MessageFlags.Ephemeral,
        });
        return result;
      } catch (error) {
        logger.error(
          `[PollList] Failed to send embed reply, trying simple reply:`,
          error,
        );
        // Fallback to simple text reply
        return await interaction.editReply({
          content: `**No Active Polls Found**\n\nThere are currently no active polls in this server.\nCreate a new poll using \`/poll create\` to get started!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Pagination
    const pollsPerPage = POLL_CONSTANTS.POLLS_PER_PAGE;
    const totalPages = Math.ceil(pollsToShow.length / pollsPerPage);
    const startIndex = (page - 1) * pollsPerPage;
    const endIndex = startIndex + pollsPerPage;
    const pagePolls = pollsToShow.slice(startIndex, endIndex);

    // Create beautiful main embed with modern design
    const title = showEnded ? `Polls` : `Active Polls`;
    const pollCount = showEnded ? allPolls.length : activePolls.length;
    const activeCount = activePolls.length;
    const endedCount = endedPolls.length;

    const description = showEnded
      ? `**${activeCount}** active • **${endedCount}** ended • **${pollCount}** total • Page ${page}/${totalPages}`
      : `**${activeCount}** active poll${activeCount === 1 ? "" : "s"} • Page ${page}/${totalPages}`;

    const mainEmbed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(showEnded ? THEME.TEXT_MUTED : THEME.PRIMARY)
      .setFooter({
        text: `${interaction.guild.name} • Poll System`,
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    // Add poll information in 2-column layout
    for (let i = 0; i < pagePolls.length; i += 2) {
      const leftPoll = pagePolls[i];
      const rightPoll = pagePolls[i + 1];

      // Calculate global poll numbers (continuing from previous pages)
      const leftPollNumber = startIndex + i + 1;
      const rightPollNumber = startIndex + i + 2;

      // Process left poll
      const leftPollCard = leftPoll
        ? await createPollCard(interaction, leftPoll, leftPollNumber)
        : null;

      // Process right poll
      const rightPollCard = rightPoll
        ? await createPollCard(interaction, rightPoll, rightPollNumber)
        : null;

      // Add fields for 2-column layout
      if (leftPollCard) {
        mainEmbed.addFields({
          name: `\u200b`, // Invisible character for spacing
          value: leftPollCard,
          inline: true,
        });
      }

      if (rightPollCard) {
        mainEmbed.addFields({
          name: `\u200b`, // Invisible character for spacing
          value: rightPollCard,
          inline: true,
        });
      }
    }

    // Create components for pagination
    const components = [];
    if (totalPages > 1) {
      const paginationRow = new ActionRowBuilder();

      // Previous page button
      if (page > 1) {
        paginationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_list_page_${page - 1}`)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.ACTIONS.BACK),
        );
      }

      // Page indicator
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId("poll_list_current")
          .setLabel(`${page} / ${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
          .setEmoji(EMOJIS.UI.MENU),
      );

      // Next page button
      if (page < totalPages) {
        paginationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_list_page_${page + 1}`)
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.ACTIONS.FORWARD),
        );
      }

      components.push(paginationRow);
    }

    // No action buttons needed - users can use /poll create command directly
    // Native Discord polls don't need custom refresh functionality

    const executionTime = Date.now() - startTime;
    logger.info(
      `Poll list displayed: ${pagePolls.length} polls (${executionTime}ms)`,
    );

    return await interaction.editReply({
      embeds: [mainEmbed],
      components,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("Error listing polls", error);
    return await interaction.editReply(
      errorEmbed({
        title: "Poll List Failed",
        description: "An error occurred while listing polls.",
        solution:
          "Please try again later or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle poll deletion
 * @param {import("discord.js").CommandInteraction} interaction - The interaction object
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollDelete(
  interaction,
  _client,
  _deferred = false,
) {
  const startTime = Date.now();

  try {
    const pollId = interaction.options.getString("poll-id");
    const storageManager = await getStorageManager();
    const poll = await storageManager.getPollById(pollId);

    if (!poll) {
      return await interaction.editReply(
        errorEmbed({
          title: "Poll Not Found",
          description: `No poll found with ID: \`${pollId}\``,
          solution: "Please check the poll ID and try again.",
        }),
      );
    }

    // Check if user can delete this poll
    const isCreator = poll.creatorId === interaction.user.id;
    const isAdmin =
      interaction.member &&
      interaction.member.permissions &&
      interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isCreator && !isAdmin) {
      return await interaction.editReply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You can only delete polls you created or if you have Manage Messages permission.",
          solution:
            "Contact the poll creator or a server administrator for assistance.",
        }),
      );
    }

    // Try to delete the poll message from Discord channel
    let messageDeleted = false;
    try {
      const channel = await interaction.guild.channels.fetch(poll.channelId);
      const message = await channel.messages.fetch(poll.messageId);
      await message.delete();
      messageDeleted = true;
      logger.info(`🗑️ Poll message deleted from channel: ${poll.messageId}`);
    } catch (error) {
      logger.warn(
        `⚠️ Could not delete poll message ${poll.messageId}:`,
        error.message,
      );
      // Continue with database cleanup even if message deletion fails
    }

    // Remove poll from storage
    const dbDeleted = await storageManager.deletePoll(pollId);

    const executionTime = Date.now() - startTime;
    logger.info(
      `Poll deleted: ${pollId} by ${interaction.user.tag} (${executionTime}ms)`,
    );

    // Provide appropriate feedback based on what was successfully deleted
    let responseMessage;
    if (messageDeleted && dbDeleted) {
      responseMessage = `**Poll Deleted Successfully**\nPoll \`${pollId}\` has been completely removed from both the channel and database.`;
    } else if (dbDeleted) {
      responseMessage = `**Poll Partially Deleted**\nPoll \`${pollId}\` has been removed from the database, but the message could not be deleted from the channel (it may have been already deleted or you may lack permissions).`;
    } else {
      responseMessage = `**Poll Deletion Failed**\nFailed to delete poll \`${pollId}\` from the database. Please try again or contact support.`;
    }

    return await interaction.editReply({
      content: responseMessage,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("Error deleting poll", error);
    return await interaction.editReply(
      errorEmbed({
        title: "Poll Deletion Failed",
        description: "An error occurred while deleting the poll.",
        solution:
          "Please try again later or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle poll list pagination buttons
 * @param {import("discord.js").ButtonInteraction} interaction - The button interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollListButton(interaction, _client) {
  try {
    const { customId } = interaction;

    // Handle pagination buttons
    if (customId.startsWith("poll_list_page_")) {
      const page = parseInt(customId.split("_")[3]);
      const showEnded = interaction.message.embeds[0]?.title?.includes("Polls");

      // Defer the interaction first
      await interaction.deferUpdate();

      // Get the same data as handlePollList but directly
      const storageManager = await getStorageManager();
      const guildPolls = await storageManager.getPollsByGuild(
        interaction.guild.id,
      );
      const allPolls = Object.values(guildPolls);

      // Calculate which polls are actually active and update expired polls
      const now = new Date();
      const pollsToUpdate = [];

      const activePolls = allPolls.filter(poll => {
        const createdAt = new Date(poll.createdAt);
        const durationMs = poll.duration * 60 * 60 * 1000;
        const endTime = new Date(createdAt.getTime() + durationMs);
        const remainingMs = endTime.getTime() - now.getTime();

        if (poll.isActive && remainingMs <= 0) {
          pollsToUpdate.push({
            ...poll,
            isActive: false,
            endedAt: new Date().toISOString(),
            endedBy: "system",
          });
          return false;
        }

        return poll.isActive && remainingMs > 0;
      });

      const endedPolls = allPolls.filter(poll => {
        const createdAt = new Date(poll.createdAt);
        const durationMs = poll.duration * 60 * 60 * 1000;
        const endTime = new Date(createdAt.getTime() + durationMs);
        const remainingMs = endTime.getTime() - now.getTime();

        return !poll.isActive || remainingMs <= 0;
      });

      // Update expired polls in the background
      if (pollsToUpdate.length > 0) {
        Promise.all(
          pollsToUpdate.map(poll => storageManager.updatePoll(poll.id, poll)),
        )
          .then(() => {
            logger.info(`Updated ${pollsToUpdate.length} expired polls`);
          })
          .catch(error => {
            logger.error("Failed to update expired polls:", error);
          });
      }

      // Determine which polls to show
      const pollsToShow = showEnded ? allPolls : activePolls;

      if (pollsToShow.length === 0) {
        const title = showEnded
          ? `${EMOJIS.UI.PROGRESS} Polls`
          : `${EMOJIS.UI.PROGRESS} Active Polls`;
        const description = showEnded
          ? `**No polls found in this server.**\n\nCreate your first poll using \`/poll create\` to get started!`
          : `**No active polls found.**\n\nCreate a new poll using \`/poll create\` to get started!`;

        const emptyEmbed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(THEME.TEXT_MUTED)
          .addFields({
            name: `Quick Start`,
            value:
              "• Use `/poll create` to create a new poll\n• Set duration from 1 hour to 7 days\n• Choose single or multiple choice voting\n• Add emojis to make polls more engaging",
            inline: false,
          })
          .setFooter({
            text: `${interaction.guild.name} • Poll System`,
            iconURL: interaction.guild.iconURL({ dynamic: true }),
          })
          .setTimestamp();

        return await interaction.editReply({
          embeds: [emptyEmbed],
          components: [],
        });
      }

      // Pagination
      const pollsPerPage = POLL_CONSTANTS.POLLS_PER_PAGE;
      const totalPages = Math.ceil(pollsToShow.length / pollsPerPage);
      const startIndex = (page - 1) * pollsPerPage;
      const endIndex = startIndex + pollsPerPage;
      const pagePolls = pollsToShow.slice(startIndex, endIndex);

      // Create beautiful main embed with modern design
      const title = showEnded ? `Polls` : `Active Polls`;
      const pollCount = showEnded ? allPolls.length : activePolls.length;
      const activeCount = activePolls.length;
      const endedCount = endedPolls.length;

      const description = showEnded
        ? `**${activeCount}** active • **${endedCount}** ended • **${pollCount}** total • Page ${page}/${totalPages}`
        : `**${activeCount}** active poll${activeCount === 1 ? "" : "s"} • Page ${page}/${totalPages}`;

      const mainEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(showEnded ? THEME.TEXT_MUTED : THEME.PRIMARY)
        .setFooter({
          text: `${interaction.guild.name} • Poll System`,
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        })
        .setTimestamp();

      // Add poll information in 2-column layout
      for (let i = 0; i < pagePolls.length; i += 2) {
        const leftPoll = pagePolls[i];
        const rightPoll = pagePolls[i + 1];

        // Calculate global poll numbers (continuing from previous pages)
        const leftPollNumber = startIndex + i + 1;
        const rightPollNumber = startIndex + i + 2;

        // Process left poll
        const leftPollCard = leftPoll
          ? await createPollCard(interaction, leftPoll, leftPollNumber)
          : null;

        // Process right poll
        const rightPollCard = rightPoll
          ? await createPollCard(interaction, rightPoll, rightPollNumber)
          : null;

        // Add fields for 2-column layout
        if (leftPollCard) {
          mainEmbed.addFields({
            name: `\u200b`, // Invisible character for spacing
            value: leftPollCard,
            inline: true,
          });
        }

        if (rightPollCard) {
          mainEmbed.addFields({
            name: `\u200b`, // Invisible character for spacing
            value: rightPollCard,
            inline: true,
          });
        }
      }

      // Create components for pagination
      const components = [];
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder();

        // Previous page button
        if (page > 1) {
          paginationRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_list_page_${page - 1}`)
              .setLabel("Previous")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(EMOJIS.ACTIONS.BACK),
          );
        }

        // Page indicator
        paginationRow.addComponents(
          new ButtonBuilder()
            .setCustomId("poll_list_current")
            .setLabel(`${page} / ${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
            .setEmoji(EMOJIS.UI.MENU),
        );

        // Next page button
        if (page < totalPages) {
          paginationRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_list_page_${page + 1}`)
              .setLabel("Next")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(EMOJIS.ACTIONS.FORWARD),
          );
        }

        components.push(paginationRow);
      }

      await interaction.editReply({
        embeds: [mainEmbed],
        components,
      });
    } else if (customId === "poll_list_current") {
      // Current page button is disabled, just acknowledge
      await interaction.deferUpdate();
    }
  } catch (error) {
    logger.error("Error handling poll list button", error);
    await interaction.reply(
      errorEmbed({
        title: "Button Error",
        description: "An error occurred while processing the button.",
        solution: "Please try again or contact support if the issue persists.",
      }),
      { flags: MessageFlags.Ephemeral },
    );
  }
}

// Native polls handle results automatically - no custom functions needed

// Poll results command removed - native Discord polls show results automatically
