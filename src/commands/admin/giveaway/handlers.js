/**
 * Giveaway Command Handlers
 * @module commands/admin/giveaway/handlers
 */

import { PermissionFlagsBits, MessageFlags } from "discord.js";
import giveawayManager from "../../../features/giveaway/GiveawayManager.js";
import {
  createGiveawayEmbed,
  createConfirmationEmbed,
  createGiveawayListEmbed,
} from "./embeds.js";
import {
  createActiveGiveawayActions,
  createListPaginationButtons,
} from "./components.js";
import {
  parseDuration,
  validateGiveawayCreation,
  sanitizeText,
} from "../../../utils/giveaway/utils.js";
import { getMentionableCommand } from "../../../utils/commandUtils.js";
import {
  FREE_TIER,
  PRO_TIER,
  CORE_STATUS,
} from "../../../features/premium/config.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

/**
 * Handle /giveaway create command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCreate(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const prize = interaction.options.getString("prize");
    const winners = interaction.options.getInteger("winners");
    const duration = interaction.options.getString("duration");
    const channel = interaction.options.getChannel("channel");
    const description = interaction.options.getString("description");
    const requiredRole = interaction.options.getRole("required-role");
    const minLevel = interaction.options.getInteger("min-level");
    const requireVote = interaction.options.getBoolean("require-vote");
    const claimPeriod = interaction.options.getInteger("claim-period");
    const minAccountAge = interaction.options.getInteger("min-account-age");
    const minServerAge = interaction.options.getInteger("min-server-age");

    const targetChannel = channel || interaction.channel;

    // Validate input
    const validation = validateGiveawayCreation({
      prize,
      winners,
      duration,
      description,
    });

    if (!validation.valid) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Input",
            validation.errors.join("\n"),
            "error",
          ),
        ],
      });
    }

    const durationMs = parseDuration(duration);

    // Check bot permissions
    const botPermissions = targetChannel.permissionsFor(
      interaction.client.user,
    );

    if (!botPermissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Permission Error",
            "I don't have permission to send messages in that channel!",
            "error",
          ),
        ],
      });
    }

    if (!botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Permission Error",
            "I need **Embed Links** permission to create giveaways!",
            "error",
          ),
        ],
      });
    }

    // Get premium status
    const isPro = await giveawayManager.premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    // Limit Check 1: Max Active Giveaways
    const maxActive = isPro
      ? PRO_TIER.GIVEAWAY_MAX_ACTIVE
      : FREE_TIER.GIVEAWAY_MAX_ACTIVE;

    const activeGiveaways = await giveawayManager.getActiveForGuild(
      interaction.guild.id,
    );

    if (activeGiveaways.length >= maxActive) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Account Limit Reached",
            `You already have **${activeGiveaways.length}** active giveaways! This is the strict maximum limit for your plan.\n\n${!isPro ? `Upgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** to instantly unlock capacity for **${PRO_TIER.GIVEAWAY_MAX_ACTIVE} simultaneous giveaways**!\nEnable it on our [website](https://rolereactor.app) with Cores.` : "You have reached the maximum active capacity for Pro Engine."}`,
            "error",
          ),
        ],
      });
    }

    // Limit Check 2: Max Winners
    const maxWinners = isPro
      ? PRO_TIER.GIVEAWAY_MAX_WINNERS
      : FREE_TIER.GIVEAWAY_MAX_WINNERS;

    if (winners > maxWinners) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Winner Limit Exceeded",
            `You can have a maximum of **${maxWinners} winners** on your current plan.${!isPro ? `\n\nUpgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** for up to **20 winners**!\nEnable it on our **[website](https://rolereactor.app)** using Cores. You can purchase Cores on the site or earn them for free with ${getMentionableCommand(interaction.client, "vote")}.` : ""}`,
            "error",
          ),
        ],
      });
    }

    // Create giveaway in database
    const giveaway = await giveawayManager.create({
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      prize: sanitizeText(prize),
      winners,
      duration: durationMs,
      description: description ? sanitizeText(description) : "",
      host: interaction.user.id,
      hostUsername: interaction.user.tag,
      requiredRoles: requiredRole ? [requiredRole.id] : [],
      minLevel: minLevel || 0,
      requireVote: requireVote || false,
      claimPeriod,
      minAccountAge,
      minServerAge,
    });

    // Create and send giveaway message
    const totalEntries = await giveawayManager.getTotalEntries(
      giveaway._id.toString(),
    );
    const embed = createGiveawayEmbed(
      giveaway,
      totalEntries,
      interaction.client,
    );
    const components = createActiveGiveawayActions(giveaway._id.toString());

    const message = await targetChannel.send({
      embeds: [embed],
      components: [components],
    });

    // Update giveaway with message ID
    await giveawayManager.updateMessageId(giveaway._id.toString(), message.id);

    // Update embed with message link
    const updatedEmbed = createGiveawayEmbed(
      giveaway,
      totalEntries,
      interaction.client,
    );
    updatedEmbed.setFooter({
      text: `Hosted by ${interaction.user.tag} • ID: ${giveaway.shortId || giveaway._id.toString().slice(-6)}`,
    });

    await message.edit({
      embeds: [updatedEmbed],
      components: [components],
    });

    logger.info(
      `🎉 Giveaway created by ${interaction.user.tag} in ${interaction.guild.name}`,
    );

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Created!",
          `Your giveaway for **${sanitizeText(prize)}** has been created!\n\n[View Giveaway](${message.url})`,
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error creating giveaway:", error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            "Failed to create giveaway. Please try again.",
            "error",
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to create giveaway. Please try again.",
          "error",
        ),
      ],
    });
  }
}

/**
 * Handle /giveaway list command
 * @param {Object} interaction - Discord interaction
 */
export async function handleList(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const page = interaction.options.getInteger("page") || 1;
    const showAll = interaction.options.getBoolean("show-all") || false;
    const limit = 4; // Display 4 per page to prevent massive vertical embeds

    let giveaways;
    if (showAll) {
      giveaways = await giveawayManager.getAllForGuild(interaction.guild.id);
    } else {
      giveaways = await giveawayManager.getActiveForGuild(interaction.guild.id);
    }

    // Sort by creation date (newest first)
    giveaways.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Paginate
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

    return interaction.editReply({
      embeds: [embed],
      components,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    logger.error("❌ Error listing giveaways:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to list giveaways. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Handle /giveaway end command
 * @param {Object} interaction - Discord interaction
 */
export async function handleEnd(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const giveawayId = interaction.options.getString("giveaway-id");

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Not Found",
            "Giveaway not found. Please check the ID.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Giveaway",
            "This giveaway is not from this server.",
            "error",
          ),
        ],
      });
    }

    const result = await giveawayManager.endGiveaway(giveawayId);

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

    logger.info(`🏁 Giveaway ended by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Ended",
          `Giveaway ended successfully! ${result.winners.length} winner(s) selected.`,
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error ending giveaway:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to end giveaway. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Handle /giveaway reroll command
 * @param {Object} interaction - Discord interaction
 */
export async function handleReroll(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const giveawayId = interaction.options.getString("giveaway-id");
    const winners = interaction.options.getInteger("winners");

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Not Found",
            "Giveaway not found. Please check the ID.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Giveaway",
            "This giveaway is not from this server.",
            "error",
          ),
        ],
      });
    }

    const result = await giveawayManager.rerollGiveaway(giveawayId, winners);

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

    logger.info(
      `🔄 Giveaway rerolled by ${interaction.user.tag}: ${giveawayId}`,
    );

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Rerolled",
          `New winner(s) selected successfully!`,
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error rerolling giveaway:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to reroll giveaway. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Handle /giveaway cancel command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCancel(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const giveawayId = interaction.options.getString("giveaway-id");

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Not Found",
            "Giveaway not found. Please check the ID.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Giveaway",
            "This giveaway is not from this server.",
            "error",
          ),
        ],
      });
    }

    const result = await giveawayManager.cancelGiveaway(giveawayId);

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

    logger.info(
      `🚫 Giveaway cancelled by ${interaction.user.tag}: ${giveawayId}`,
    );

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Cancelled",
          "Giveaway has been cancelled. No winners will be selected.",
          "warning",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error cancelling giveaway:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to cancel giveaway. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Handle /giveaway delete command
 * @param {Object} interaction - Discord interaction
 */
export async function handleDelete(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const giveawayId = interaction.options.getString("giveaway-id");

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Not Found",
            "Giveaway not found. Please check the ID.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Giveaway",
            "This giveaway is not from this server.",
            "error",
          ),
        ],
      });
    }

    const result = await giveawayManager.deleteGiveaway(giveawayId);

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Error",
            result.error || "Failed to delete giveaway.",
            "error",
          ),
        ],
      });
    }

    logger.info(
      `🗑️ Giveaway deleted by ${interaction.user.tag}: ${giveawayId}`,
    );

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Deleted",
          "Giveaway has been permanently deleted from the database.",
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error deleting giveaway:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          "Failed to delete giveaway. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

/**
 * Handle /giveaway edit command
 * @param {Object} interaction - Discord interaction
 */
export async function handleEdit(interaction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const giveawayId = interaction.options.getString("giveaway-id");
    const prize = interaction.options.getString("prize");
    const winners = interaction.options.getInteger("winners");
    const description = interaction.options.getString("description");

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Not Found",
            "Giveaway not found. Please check the ID.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Giveaway",
            "This giveaway is not from this server.",
            "error",
          ),
        ],
      });
    }

    if (giveaway.status !== "active") {
      return interaction.editReply({
        embeds: [
          createConfirmationEmbed(
            "Invalid Status",
            "Only active giveaways can be edited.",
            "error",
          ),
        ],
      });
    }

    const updates = {};
    if (prize) updates.prize = sanitizeText(prize);
    if (winners) {
      // Check winners limit based on tier
      const isPro = await giveawayManager.premiumManager.isFeatureActive(
        interaction.guild.id,
        "pro_engine",
      );
      const maxWinners = isPro
        ? PRO_TIER.GIVEAWAY_MAX_WINNERS
        : FREE_TIER.GIVEAWAY_MAX_WINNERS;

      if (winners > maxWinners) {
        return interaction.editReply({
          embeds: [
            createConfirmationEmbed(
              "Winner Limit Exceeded",
              `You can have a maximum of **${maxWinners} winners** on your current plan.${!isPro ? `\n\nUpgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** for up to **20 winners**!\nEnable it on our **[website](https://rolereactor.app)** using Cores. You can purchase Cores on the site or earn them for free with ${getMentionableCommand(interaction.client, "vote")}.` : ""}`,
              "error",
            ),
          ],
        });
      }

      updates.winners = winners;
    }
    if (description !== null) updates.description = sanitizeText(description);

    await giveawayManager.edit(giveawayId, updates);

    logger.info(`✏️ Giveaway edited by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Giveaway Edited",
          "Giveaway has been updated successfully!",
          "success",
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error editing giveaway:", error);

    return interaction.editReply({
      embeds: [
        createConfirmationEmbed(
          "Error",
          error.message || "Failed to edit giveaway. Please try again.",
          "error",
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}
