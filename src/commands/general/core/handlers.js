import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  createBalanceEmbed,
  createErrorEmbed,
  createValidationErrorEmbed,
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
  validateInteractionState,
  validateCommandPermissions,
} from "./validation.js";


const logger = getLogger();

/**
 * Main execution function for the /core command
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
      case "balance":
        await handleBalance(interaction);
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
      "Core command",
      perfContext.username,
    );
  } catch (error) {
    handleCoreError(error, "core command", {
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

    // Get user data
    const userData = await getUserData(perfContext.userId);

    // Create and send balance embed
    const balanceEmbed = createBalanceEmbed(
      userData,
      perfContext.username,
      interaction.user.displayAvatarURL(),
    );

    await interaction.editReply({ embeds: [balanceEmbed] });

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
 * Handles command errors with centralized error response
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 * @param {Error} error - The error that occurred
 */
async function handleCommandError(interaction, _error) {
  try {
    const errorResponse = errorEmbed({
      title: "Command Error",
      description:
        "An unexpected error occurred while processing your request. Please try again later.",
    });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorResponse] });
    } else {
      await interaction.reply({
        embeds: [errorResponse],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    logger.error("Failed to send error response:", replyError);
  }
}
