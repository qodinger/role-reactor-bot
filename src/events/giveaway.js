/**
 * Giveaway Event Handlers - Button interactions and giveaway events
 * @module events/giveaway
 */

import { EmbedBuilder } from "discord.js";
import giveawayManager from "../features/giveaway/GiveawayManager.js";
import {
  createGiveawayEmbed,
  createWinnerEmbed,
  createNoEntriesEmbed,
  createEntryConfirmEmbed,
  createConfirmationEmbed,
  createWinnerDmEmbed,
} from "../commands/general/giveaway/embeds.js";
import {
  createActiveGiveawayActions,
  createEndedGiveawayActions,
  parseButtonCustomId,
} from "../commands/general/giveaway/components.js";
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
 * @param {Object} client - Discord client
 */
export async function handleGiveawayInteraction(interaction, client) {
  const customId = interaction.customId;

  // Check if this is a giveaway button
  if (!customId.startsWith("giveaway_")) {
    return false;
  }

  const parsed = parseButtonCustomId(customId);

  switch (parsed.action) {
    case "giveaway_enter":
      await handleEnterGiveaway(interaction, client);
      break;
    case "giveaway_end":
      await handleAdminEnd(interaction, client);
      break;
    case "giveaway_reroll":
      await handleAdminReroll(interaction, client);
      break;
    case "giveaway_cancel":
      await handleAdminCancel(interaction, client);
      break;
    case "giveaway_complete":
      await handleAdminComplete(interaction, client);
      break;
    default:
      await interaction.reply({
        content: "Unknown action",
        ephemeral: true,
      });
  }

  return true;
}

/**
 * Handle user entering a giveaway
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleEnterGiveaway(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveaway = await giveawayManager.getByMessageId(
      interaction.message.id,
    );

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
    const validation = validateRequirements(giveaway, interaction.member);

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
      const updatedEmbed = createGiveawayEmbed(giveaway, newTotal);

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [createActiveGiveawayActions()],
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
        ephemeral: true,
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
 * @param {Object} client - Discord client
 */
async function handleAdminEnd(interaction, client) {
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
        ephemeral: true,
      });
    }

    const giveaway = await giveawayManager.getByMessageId(
      interaction.message.id,
    );

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        ephemeral: true,
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
    await announceWinners(
      interaction.channel,
      giveaway,
      result.winners,
      client,
    );
  } catch (error) {
    logger.error("❌ Error handling admin end:", error);
  }
}

/**
 * Handle admin rerolling a giveaway via button
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleAdminReroll(interaction, client) {
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
        ephemeral: true,
      });
    }

    const giveaway = await giveawayManager.getByMessageId(
      interaction.message.id,
    );

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        ephemeral: true,
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
      client,
      true,
    );
  } catch (error) {
    logger.error("❌ Error handling admin reroll:", error);
  }
}

/**
 * Handle admin cancelling a giveaway via button
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleAdminCancel(interaction, client) {
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
        ephemeral: true,
      });
    }

    const giveaway = await giveawayManager.getByMessageId(
      interaction.message.id,
    );

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        ephemeral: true,
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
      .setColor(0xff0000)
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
 * @param {Object} client - Discord client
 */
async function handleAdminComplete(interaction, client) {
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
        ephemeral: true,
      });
    }

    const giveaway = await giveawayManager.getByMessageId(
      interaction.message.id,
    );

    if (!giveaway) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed("Error", "Giveaway not found.", "error"),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    // Mark all winners as claimed
    for (const winner of giveaway.winnersData) {
      await giveawayManager.markClaimed(giveaway._id.toString(), winner.userId);
    }

    await interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Complete",
          "All winners have been marked as claimed.",
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error handling admin complete:", error);
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
        components: [createEndedGiveawayActions(false)],
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
      components: [createEndedGiveawayActions(true)],
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
      const totalEntries = giveaway.entries.reduce(
        (sum, e) => sum + e.count,
        0,
      );
      const endedEmbed = createGiveawayEmbed(giveaway, totalEntries);
      endedEmbed.setTitle("🏆 GIVEAWAY ENDED! 🏆");
      endedEmbed.setColor(0x00ff00);

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
        name: "🎉 Winners",
        value: winnerMentions.join("\n"),
        inline: false,
      });

      await interaction.message.edit({
        embeds: [endedEmbed],
        components: [createEndedGiveawayActions(true)],
      });
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
        .setColor(0xff0000)
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

  logger.info("🎉 Giveaway event listeners setup complete");
}
