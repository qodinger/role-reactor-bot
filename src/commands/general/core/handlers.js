import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  createBalanceEmbed,
  createPricingEmbed,
  createErrorEmbed,
} from "./embeds.js";

const logger = getLogger();

/**
 * Main execution function for the /core command
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 * @param {import("discord.js").Client} _client - The Discord client (unused)
 */
export async function execute(interaction, _client) {
  const startTime = Date.now();
  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    // Defer the interaction immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    logger.debug(
      `Core command executed by ${username} (${userId}): ${subcommand}`,
    );

    switch (subcommand) {
      case "balance":
        await handleBalance(interaction);
        break;
      case "pricing":
        await handlePricing(interaction);
        break;
      default: {
        const response = {
          content: "❌ **Unknown Subcommand**\nPlease use a valid subcommand.",
          flags: MessageFlags.Ephemeral,
        };
        await interaction.editReply(response);
        break;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Core command completed in ${duration}ms for ${username}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `Error executing core command for ${username} after ${duration}ms:`,
      error,
    );
    await handleCommandError(interaction, error);
  }
}

/**
 * Handles the balance subcommand to show user's Core credits
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 */
async function handleBalance(interaction) {
  const startTime = Date.now();
  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const storage = await getStorageManager();

    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get user's credit data with default values
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      coreTier: null,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Create and send balance embed
    const balanceEmbed = createBalanceEmbed(
      userData,
      username,
      interaction.user.displayAvatarURL(),
    );

    await interaction.editReply({ embeds: [balanceEmbed] });

    const duration = Date.now() - startTime;
    logger.info(
      `Balance check completed in ${duration}ms for ${username}: ${userData.credits} Cores`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `Error checking balance for ${username} after ${duration}ms:`,
      error,
    );

    const errorEmbed = createErrorEmbed(
      "Balance Check Failed",
      "There was an error checking your Core balance. Please try again.",
      interaction.client.user.displayAvatarURL(),
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handles the pricing subcommand to show Core pricing information
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The interaction object
 */
async function handlePricing(interaction) {
  const startTime = Date.now();
  const username = interaction.user.username;

  try {
    // Create and send pricing embed
    const pricingEmbed = createPricingEmbed(
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [pricingEmbed] });

    const duration = Date.now() - startTime;
    logger.info(`Pricing display completed in ${duration}ms for ${username}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `Error displaying pricing for ${username} after ${duration}ms:`,
      error,
    );

    const errorEmbed = createErrorEmbed(
      "Pricing Display Failed",
      "There was an error displaying Core pricing. Please try again.",
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
