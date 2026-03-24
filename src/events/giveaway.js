/**
 * Giveaway Event Handlers - Button interactions and giveaway events
 * @module events/giveaway
 */

// This file is manually imported in index.js for giveaway event setup
// Export name and execute to satisfy event loader (but they're not used)
export const name = "giveaway";
export const execute = () => {};

import { EmbedBuilder, MessageFlags } from "discord.js";
import { THEME } from "../config/theme.js";
import giveawayManager from "../features/giveaway/GiveawayManager.js";
import {
  createGiveawayEmbed,
  createWinnerEmbed,
  createNoEntriesEmbed,
  createEntryConfirmEmbed,
  createConfirmationEmbed,
  createWinnerDmEmbed,
  createGiveawayListEmbed,
} from "../commands/admin/giveaway/embeds.js";
import {
  createActiveGiveawayActions,
  createEndedGiveawayActions,
  parseButtonCustomId,
  createListPaginationButtons,
} from "../commands/admin/giveaway/components.js";
import {
  validateRequirements,
  calculateBonusEntries,
  canManageGiveaways,
} from "../utils/giveaway/utils.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger();

/**
 * Handle giveaway button interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} _client - Discord client (unused)
 */
export async function handleGiveawayInteraction(interaction, _client) {
  const customId = interaction.customId;

  // Check if this is a giveaway button
  if (!customId.startsWith("giveaway_")) {
    return false;
  }

  const parsed = parseButtonCustomId(customId);

  switch (parsed.action) {
    case "giveaway_enter":
      await handleEnterGiveaway(interaction, parsed);
      break;
    case "giveaway_end":
      await handleAdminEnd(interaction, parsed);
      break;
    case "giveaway_reroll":
      await handleAdminReroll(interaction, parsed);
      break;
    case "giveaway_cancel":
      await handleAdminCancel(interaction, parsed);
      break;
    case "giveaway_complete":
      await handleAdminComplete(interaction, parsed);
      break;
    case "giveaway_page":
      await handleListPagination(interaction, parsed);
      break;
    default:
      await interaction.reply({
        content: "Unknown action",
        flags: [MessageFlags.Ephemeral],
      });
  }

  return true;
}

/**
 * Handle user entering a giveaway
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleEnterGiveaway(interaction, parsed) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    let giveaway = null;
    if (parsed.giveawayId) {
      giveaway = await giveawayManager.getById(parsed.giveawayId);
    } else {
      giveaway = await giveawayManager.getByMessageId(interaction.message.id);
    }

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            "This giveaway no longer exists.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.status !== "active") {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Giveaway Ended",
            "This giveaway has already ended.",
            "error",
          ),
        ],
      });
    }

    // Validate requirements
    const validation = await validateRequirements(giveaway, interaction.member);

    if (!validation.valid) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Cannot Enter",
            validation.errors.join("\n"),
            "error",
          ),
        ],
      });
    }

    // Calculate entries (base + bonus)
    const baseEntries = 1;
    const bonusEntries = calculateBonusEntries(giveaway, interaction.member);
    const totalEntriesToAdd = baseEntries + bonusEntries;

    // Add entry
    const result = await giveawayManager.addEntry(
      giveaway._id.toString(),
      interaction.user.id,
      totalEntriesToAdd,
    );

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            result.error || "Failed to enter giveaway.",
            "error",
          ),
        ],
      });
    }

    // Update the giveaway message with new entry count
    try {
      const newTotal = await giveawayManager.getTotalEntries(
        giveaway._id.toString(),
      );
      const updatedEmbed = createGiveawayEmbed(
        giveaway,
        newTotal,
        interaction.client,
      );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [createActiveGiveawayActions(giveaway._id.toString())],
      });
    } catch (err) {
      logger.warn("⚠️ Failed to update giveaway message:", err.message);
    }

    // Send confirmation to user
    const confirmEmbed = createEntryConfirmEmbed(
      giveaway,
      result.entries,
      result.totalEntries,
    );

    if (bonusEntries > 0) {
      confirmEmbed.addFields({
        name: "🎁 Bonus Entries",
        value: `You received **+${bonusEntries}** bonus entries!`,
        inline: false,
      });
    }

    return interaction.editReply({
      embeds: [confirmEmbed],
    });
  } catch (error) {
    logger.error("❌ Error handling giveaway entry:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            "Failed to enter giveaway. Please try again.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            "Failed to enter giveaway. Please try again.",
            "error",
          ),
        ],
      });
    }
  }
}

/**
 * Handle admin ending a giveaway via button
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleAdminEnd(interaction, parsed) {
  try {
    if (!canManageGiveaways(interaction.member)) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Permission Denied",
            "You need **Manage Server** or **Manage Roles** permission.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    let giveaway = null;
    if (parsed.giveawayId) {
      giveaway = await giveawayManager.getById(parsed.giveawayId);
    } else {
      giveaway = await giveawayManager.getByMessageId(interaction.message.id);
    }

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferUpdate();

    const result = await giveawayManager.endGiveaway(giveaway._id.toString());

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            result.error || "Failed to end giveaway.",
            "error",
          ),
        ],
      });
    }

    // Announce winners
    await announceWinners(interaction.channel, giveaway, result.winners, null);
  } catch (error) {
    logger.error("❌ Error handling admin end:", error);
  }
}

/**
 * Handle admin rerolling a giveaway via button
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleAdminReroll(interaction, parsed) {
  try {
    if (!canManageGiveaways(interaction.member)) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Permission Denied",
            "You need **Manage Server** or **Manage Roles** permission.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    let giveaway = null;
    if (parsed.giveawayId) {
      giveaway = await giveawayManager.getById(parsed.giveawayId);
    } else {
      giveaway = await giveawayManager.getByMessageId(interaction.message.id);
    }

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferUpdate();

    const result = await giveawayManager.rerollGiveaway(
      giveaway._id.toString(),
    );

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            result.error || "Failed to reroll giveaway.",
            "error",
          ),
        ],
      });
    }

    // Announce new winners
    await announceWinners(
      interaction.channel,
      giveaway,
      result.winners,
      null,
      true,
    );
  } catch (error) {
    logger.error("❌ Error handling admin reroll:", error);
  }
}

/**
 * Handle admin cancelling a giveaway via button
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleAdminCancel(interaction, parsed) {
  try {
    if (!canManageGiveaways(interaction.member)) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Permission Denied",
            "You need **Manage Server** or **Manage Roles** permission.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    let giveaway = null;
    if (parsed.giveawayId) {
      giveaway = await giveawayManager.getById(parsed.giveawayId);
    } else {
      giveaway = await giveawayManager.getByMessageId(interaction.message.id);
    }

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferUpdate();

    const result = await giveawayManager.cancelGiveaway(
      giveaway._id.toString(),
    );

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            result.error || "Failed to cancel giveaway.",
            "error",
          ),
        ],
      });
    }

    // Update the message to show cancelled
    const cancelledEmbed = new EmbedBuilder()
      .setTitle("🚫 Giveaway Cancelled")
      .setDescription("This giveaway has been cancelled by an administrator.")
      .setColor(THEME.ERROR)
      .addFields(
        {
          name: "🎁 Prize",
          value: giveaway.prize,
          inline: true,
        },
        {
          name: "👤 Host",
          value: giveaway.host ? `<@${giveaway.host}>` : "Unknown",
          inline: true,
        },
      );

    await interaction.message.edit({
      embeds: [cancelledEmbed],
      components: [],
    });
  } catch (error) {
    logger.error("❌ Error handling admin cancel:", error);
  }
}

/**
 * Handle admin marking giveaway as complete
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleAdminComplete(interaction, parsed) {
  try {
    if (!canManageGiveaways(interaction.member)) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Permission Denied",
            "You need **Manage Server** or **Manage Roles** permission.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    let giveaway = null;
    if (parsed.giveawayId) {
      giveaway = await giveawayManager.getById(parsed.giveawayId);
    } else {
      giveaway = await giveawayManager.getByMessageId(interaction.message.id);
    }

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferUpdate();

    // Mark all winners as claimed
    for (const winner of giveaway.winnersData) {
      await giveawayManager.markClaimed(giveaway._id.toString(), winner.userId);
    }

    // Preserve the existing embed but update the footer and strip all buttons
    const existingEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    existingEmbed.setFooter({
      text: "Giveaway Completed • All Prizes Claimed!",
    });

    await interaction.message.edit({
      embeds: [existingEmbed],
      components: [],
    });

    // Provide a small quiet confirmation to the admin
    await interaction.followUp({
      content:
        "All winners have been marked as claimed and the giveaway is now locked.",
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    logger.error("❌ Error handling admin complete:", error);
  }
}

/**
 * Handle listing pagination button clicks
 * @param {Object} interaction - Discord interaction
 * @param {Object} parsed - Parsed custom ID data
 */
async function handleListPagination(interaction, parsed) {
  try {
    const showAll = parsed.giveawayId === "all"; // 'all' or 'act' filter mapped to giveawayId slot
    const page = parseInt(parsed.extra) || 1;
    const limit = 4;

    let giveaways;
    if (showAll) {
      giveaways = await giveawayManager.getAllForGuild(interaction.guild.id);
    } else {
      giveaways = await giveawayManager.getActiveForGuild(interaction.guild.id);
    }

    giveaways.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    const totalPages = Math.ceil(giveaways.length / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const skip = (currentPage - 1) * limit;
    const paginatedGiveaways = giveaways.slice(skip, skip + limit);

    const embed = createGiveawayListEmbed(
      paginatedGiveaways,
      interaction.guild,
      currentPage,
      totalPages,
      giveaways.length,
      interaction.client,
      showAll,
    );

    const components =
      totalPages > 1
        ? [createListPaginationButtons(currentPage, totalPages, showAll)]
        : [];

    await interaction.update({
      embeds: [embed],
      components,
    });
  } catch (error) {
    logger.error("❌ Error paginating giveaway list:", error);
    await interaction.reply({
      content: "Failed to load page. Please try again.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Announce giveaway winners
 * @param {Object} channel - Discord channel
 * @param {Object} giveaway - Giveaway data
 * @param {Array} winners - Array of winners
 * @param {Object} client - Discord client
 * @param {boolean} isReroll - Whether this is a reroll
 */
async function announceWinners(
  channel,
  giveaway,
  winners,
  client,
  isReroll = false,
) {
  try {
    if (winners.length === 0) {
      const noEntriesEmbed = createNoEntriesEmbed(giveaway);
      await channel.send({
        embeds: [noEntriesEmbed],
        components: [
          createEndedGiveawayActions(giveaway._id.toString(), false),
        ],
      });
      return;
    }

    // Create winner announcement
    const winnerEmbed = await createWinnerEmbed(giveaway, winners, client);

    if (isReroll) {
      winnerEmbed.setTitle("🔄 GIVEAWAY REROLL! 🔄");
      winnerEmbed.setFooter({
        text: "This is a reroll - new winner(s) selected!",
      });
    }

    await channel.send({
      embeds: [winnerEmbed],
      components: [createEndedGiveawayActions(giveaway._id.toString(), true)],
    });

    // DM winners
    for (const winner of winners) {
      try {
        const user = await client.users.fetch(winner.userId);
        const dmEmbed = createWinnerDmEmbed(giveaway, channel.guild.name);

        await user.send({
          embeds: [dmEmbed],
        });
      } catch (err) {
        logger.warn(`⚠️ Could not DM winner ${winner.userId}:`, err.message);
      }
    }

    // Update original giveaway message
    try {
      if (giveaway.messageId) {
        const message = await channel.messages.fetch(giveaway.messageId);
        const totalEntries = giveaway.entries.reduce(
          (sum, e) => sum + e.count,
          0,
        );
        const endedEmbed = createGiveawayEmbed(giveaway, totalEntries, client);
        endedEmbed.setTitle("🏆 GIVEAWAY ENDED! 🏆");
        endedEmbed.setColor(THEME.SUCCESS);

        const winnerMentions = [];
        for (const winner of winners) {
          try {
            const user = await client.users.fetch(winner.userId);
            winnerMentions.push(`${user.tag}`);
          } catch {
            winnerMentions.push("Unknown User");
          }
        }

        endedEmbed.addFields({
          name: "Winners",
          value: winnerMentions.join(", "),
          inline: false,
        });

        await message.edit({
          embeds: [endedEmbed],
          components: [
            createEndedGiveawayActions(giveaway._id.toString(), true),
          ],
        });
      }
    } catch (err) {
      logger.warn("⚠️ Failed to update giveaway message:", err.message);
    }
  } catch (error) {
    logger.error("❌ Error announcing winners:", error);
  }
}

/**
 * Setup giveaway event listeners
 * @param {Object} manager - GiveawayManager instance
 * @param {Object} client - Discord client
 */
export function setupGiveawayEvents(manager, client) {
  // Handle giveaway ended event
  manager.on("giveawayEnded", async (giveaway, winners) => {
    try {
      const channel = await client.channels.fetch(giveaway.channelId);

      if (!channel) {
        logger.warn(
          `⚠️ Could not find channel ${giveaway.channelId} for giveaway`,
        );
        return;
      }

      await announceWinners(channel, giveaway, winners, client);
    } catch (error) {
      logger.error("❌ Error in giveawayEnded event:", error);
    }
  });

  // Handle giveaway rerolled event
  manager.on("giveawayRerolled", async (giveaway, winners) => {
    try {
      const channel = await client.channels.fetch(giveaway.channelId);

      if (!channel) {
        logger.warn(
          `⚠️ Could not find channel ${giveaway.channelId} for giveaway`,
        );
        return;
      }

      await announceWinners(channel, giveaway, winners, client, true);
    } catch (error) {
      logger.error("❌ Error in giveawayRerolled event:", error);
    }
  });

  // Handle giveaway cancelled event
  manager.on("giveawayCancelled", async giveaway => {
    try {
      const channel = await client.channels.fetch(giveaway.channelId);

      if (!channel) {
        logger.warn(
          `⚠️ Could not find channel ${giveaway.channelId} for giveaway`,
        );
        return;
      }

      const cancelledEmbed = new EmbedBuilder()
        .setTitle("🚫 Giveaway Cancelled")
        .setDescription("This giveaway has been cancelled.")
        .setColor(THEME.ERROR)
        .addFields(
          {
            name: "🎁 Prize",
            value: giveaway.prize,
            inline: true,
          },
          {
            name: "👤 Host",
            value: giveaway.host ? `<@${giveaway.host}>` : "Unknown",
            inline: true,
          },
        );

      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.edit({
          embeds: [cancelledEmbed],
          components: [],
        });
      } catch (err) {
        logger.warn(
          "⚠️ Could not update cancelled giveaway message:",
          err.message,
        );
      }
    } catch (error) {
      logger.error("❌ Error in giveawayCancelled event:", error);
    }
  });

  // Handle giveaway edited event
  manager.on("giveawayEdited", async giveaway => {
    try {
      const channel = await client.channels.fetch(giveaway.channelId);

      if (!channel) return;

      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        const totalEntries = giveaway.entries.reduce(
          (sum, e) => sum + e.count,
          0,
        );

        const updatedEmbed = createGiveawayEmbed(
          giveaway,
          totalEntries,
          client,
        );
        updatedEmbed.setFooter({
          text: `Hosted by ${giveaway.hostUsername || "Server Staff"} • ID: ${giveaway.shortId || giveaway._id.toString().slice(-6)}`,
        });

        // Use the existing components logic to ensure the button is refreshed
        const components = createActiveGiveawayActions(giveaway._id.toString());

        await message.edit({
          embeds: [updatedEmbed],
          components: [components],
        });

        logger.info(
          `🔄 Live giveaway message updated on Discord: ${giveaway._id.toString()}`,
        );
      } catch (err) {
        logger.warn(
          "⚠️ Could not update edited giveaway message:",
          err.message,
        );
      }
    } catch (error) {
      logger.error("❌ Error in giveawayEdited event:", error);
    }
  });
  logger.info("🎉 Giveaway event listeners setup complete");
}
