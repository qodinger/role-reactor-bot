import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createErrorEmbed } from "./paymentEmbeds.js";

const logger = getLogger();

/**
 * Execute payment command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
 * @param {import('discord.js').Client} _client - The Discord client (unused)
 */
export async function execute(interaction, _client) {
  try {
    // Defer the interaction immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Payment command functionality removed
    const errorEmbed = createErrorEmbed(
      "Command Unavailable",
      "Payment functionality is currently unavailable. Please contact support for assistance.",
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
  } catch (error) {
    logger.error("Error in payment command:", error);
    const errorResponse = errorEmbed({
      title: "Payment Error",
      description:
        "An unexpected error occurred while processing your payment request. Please try again later.",
    });
    await interaction.editReply({ embeds: [errorResponse] });
  }
}

/**
 * Payment command definition
 * Note: Only one-time crypto payments are supported (subscriptions removed)
 */
export const data = new SlashCommandBuilder()
  .setName("core-pay")
  .setDescription(
    "Purchase Core credits using cryptocurrency (one-time payment)",
  )
  .setDefaultMemberPermissions(0n); // Visible to all users
