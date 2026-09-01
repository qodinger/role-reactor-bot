import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { config } from "../../../config/config.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import {
  createBalanceEmbed,
  createErrorEmbed,
  createValidationErrorEmbed,
  createSendSuccessEmbed,
  createSendConfirmationEmbed,
  createSendCancelledEmbed,
} from "./embeds.js";
import {
  getUserData,
  handleCoreError,
  logOperationDuration,
  createPerformanceContext,
} from "./utils.js";
import {
  validateCoreCommandInputs,
  validateBalanceInputs,
  validateSendInputs,
  validateInteractionState,
  validateCommandPermissions,
} from "./validation.js";

const logger = getLogger();

/**
 * Main execution function for the /balance command
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 * @param {import("discord.js").Client} _client - The Discord client (unused)
 */
export async function execute(interaction, _client) {
  const perfContext = createPerformanceContext(
    "core command",
    interaction.user.username,
    interaction.user.id,
  );

  try {
    // Validate interaction state
    const stateValidation = validateInteractionState(interaction);
    if (!stateValidation.valid) {
      logger.warn(`Interaction validation failed: ${stateValidation.error}`);
      return;
    }

    // Validate command permissions
    const permissionValidation = validateCommandPermissions(interaction);
    if (!permissionValidation.valid) {
      logger.warn(
        `Permission validation failed: ${permissionValidation.error}`,
      );
      return;
    }

    // Validate core command inputs
    const inputValidation = validateCoreCommandInputs(interaction);
    if (!inputValidation.valid) {
      const errorEmbed = createValidationErrorEmbed(
        inputValidation.errors,
        interaction.client,
      );
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer the interaction immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { subcommand } = inputValidation.data;

    logger.debug(
      `Core command executed by ${perfContext.username} (${perfContext.userId}): ${subcommand}`,
    );

    switch (subcommand) {
      case "check":
        await handleBalance(interaction);
        break;

      case "send":
        await handleSend(interaction);
        break;

      default: {
        const errorEmbed = createErrorEmbed(
          "Unknown Subcommand",
          "Please use a valid subcommand.",
          interaction.client.user.displayAvatarURL(),
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        break;
      }
    }

    logOperationDuration(
      perfContext.startTime,
      "Balance command",
      perfContext.username,
    );
  } catch (error) {
    handleCoreError(error, "balance command", {
      userId: perfContext.userId,
      username: perfContext.username,
    });
    await handleCommandError(interaction, error);
  }
}

/**
 * Handles the balance subcommand to show user's Core credits
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 */
async function handleBalance(interaction) {
  const perfContext = createPerformanceContext(
    "balance check",
    interaction.user.username,
    interaction.user.id,
  );

  try {
    // Validate balance inputs
    const inputValidation = validateBalanceInputs(interaction);
    if (!inputValidation.valid) {
      const errorEmbed = createValidationErrorEmbed(
        inputValidation.errors,
        interaction.client,
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Get required data
    const userData = await getUserData(perfContext.userId);

    // Create and send balance embed with enhanced data
    const balanceEmbed = createBalanceEmbed(
      userData,
      perfContext.username,
      interaction.user.displayAvatarURL(),
      { client: interaction.client },
    );

    // Add quick action buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Get Cores")
        .setStyle(ButtonStyle.Link)
        .setURL(config.externalLinks.website)
        .setEmoji("🚀"),
    );

    const /** @type {any} */ buttonRow = buttons;

    await interaction.editReply({
      embeds: [balanceEmbed],
      components: [buttonRow],
    });

    logOperationDuration(
      perfContext.startTime,
      "Balance check",
      perfContext.username,
    );

    logger.info(
      `Balance check completed for ${perfContext.username}: ${userData.credits} Cores`,
    );
  } catch (error) {
    handleCoreError(error, "balance check", {
      userId: perfContext.userId,
      username: perfContext.username,
    });

    const errorEmbed = createErrorEmbed(
      "Balance Check Failed",
      "There was an error checking your Core balance. Please try again.",
      interaction.client.user.displayAvatarURL(),
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handles the send subcommand to transfer Paid Cores to another user with 10% tax
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 */
async function handleSend(interaction) {
  const perfContext = createPerformanceContext(
    "core send",
    interaction.user.username,
    interaction.user.id,
  );

  try {
    const sendValidation = validateSendInputs(interaction);
    if (!sendValidation.valid) {
      const errEmbed = createValidationErrorEmbed(
        sendValidation.errors,
        interaction.client,
      );
      await interaction.editReply({ embeds: [errEmbed] });
      return;
    }

    const { targetUser, amount } = sendValidation.data;
    const senderUserId = interaction.user.id;
    const targetUserId = targetUser.id;

    const dbManager = await getDatabaseManager();
    const senderData = await dbManager.coreCredits.getByUserId(senderUserId);
    const senderCredits = senderData?.credits || 0;

    if (senderCredits < amount) {
      const errEmbed = createErrorEmbed(
        "Insufficient Cores",
        `You currently have **${senderCredits.toFixed(2)} Paid Cores 🔮**, but tried to send **${amount.toFixed(2)} Cores**.\n\n*(Note: Sparks ⚡ are reward points and cannot be sent).*`,
        interaction.client.user.displayAvatarURL(),
      );
      await interaction.editReply({ embeds: [errEmbed] });
      return;
    }

    // 10% Deflationary Transfer Tax calculation
    const taxAmount = Math.round(amount * 0.1 * 100) / 100;
    const netAmount = Math.round((amount - taxAmount) * 100) / 100;

    const confirmEmbed = createSendConfirmationEmbed({
      targetUser,
      grossAmount: amount,
      taxAmount,
      netAmount,
      client: interaction.client,
    });

    const confirmCustomId = `send_confirm_${interaction.id}`;
    const cancelCustomId = `send_cancel_${interaction.id}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmCustomId)
        .setLabel("Confirm Transfer")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId(cancelCustomId)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
    );

    const message = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    });

    try {
      const confirmation = await message.awaitMessageComponent({
        filter: i => {
          if (i.user.id !== interaction.user.id) {
            i.reply({
              content: "You cannot confirm or cancel someone else's transfer.",
              flags: MessageFlags.Ephemeral,
            });
            return false;
          }
          return (
            i.customId === confirmCustomId || i.customId === cancelCustomId
          );
        },
        time: 60000,
      });

      if (confirmation.customId === cancelCustomId) {
        await confirmation.update({
          embeds: [
            createSendCancelledEmbed(
              "You cancelled the Core transfer.",
              interaction.client,
            ),
          ],
          components: [],
        });
        return;
      }

      // Re-verify sender balance before executing transfer
      const freshSenderData =
        await dbManager.coreCredits.getByUserId(senderUserId);
      const freshCredits = freshSenderData?.credits || 0;
      if (freshCredits < amount) {
        await confirmation.update({
          embeds: [
            createErrorEmbed(
              "Insufficient Cores",
              `Your balance changed. You currently have **${freshCredits.toFixed(2)} Paid Cores 🔮**, but tried to send **${amount.toFixed(2)} Cores**.`,
              interaction.client.user.displayAvatarURL(),
            ),
          ],
          components: [],
        });
        return;
      }

      // Atomic Balance Transfers
      await dbManager.coreCredits.updateCredits(senderUserId, -amount);
      await dbManager.coreCredits.updateCredits(targetUserId, netAmount);

      const sendEmbed = createSendSuccessEmbed({
        senderUser: interaction.user,
        targetUser,
        grossAmount: amount,
        taxAmount,
        netAmount,
        client: interaction.client,
      });

      await confirmation.update({
        embeds: [sendEmbed],
        components: [],
      });

      logger.info(
        `Core send executed: ${interaction.user.username} sent ${amount} Cores to ${targetUser.username} (${taxAmount} tax burned, ${netAmount} received)`,
      );
    } catch (_timeoutError) {
      // Handle 60s timeout
      await interaction.editReply({
        embeds: [
          createSendCancelledEmbed(
            "Confirmation timed out (60 seconds expired). No Cores were transferred.",
            interaction.client,
          ),
        ],
        components: [],
      });
    }
  } catch (error) {
    handleCoreError(error, "core send", {
      userId: perfContext.userId,
      username: perfContext.username,
    });

    const errorEmbed = createErrorEmbed(
      "Transfer Failed",
      "An error occurred while transferring Cores. Please try again.",
      interaction.client.user.displayAvatarURL(),
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handles command errors with centralized error response
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 * @param {Error} _error - The error that occurred
 */
async function handleCommandError(interaction, _error) {
  try {
    const errorResponse = errorEmbed({
      title: "Command Error",
      description:
        "An unexpected error occurred while processing your request. Please try again later.",
    });

    if (interaction.deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  } catch (replyError) {
    logger.error("Failed to send error response:", replyError);
  }
}
