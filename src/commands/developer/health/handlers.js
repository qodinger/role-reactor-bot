import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { createHealthEmbed } from "./embeds.js";

// ============================================================================
// HEALTH COMMAND HANDLERS
// ============================================================================

export async function handleHealthCheck(interaction, client, deferred = true) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Check developer permissions
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for health command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      const response = {
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
        flags: MessageFlags.Ephemeral,
      };

      if (deferred) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
      return;
    }

    // Create health status embed
    const embed = await createHealthEmbed(client, startTime);

    // Send response
    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    logger.info("Health check completed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("Error in health check:", error);
    await handleHealthError(interaction, error, deferred);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

async function handleHealthError(interaction, error, deferred) {
  const logger = getLogger();
  logger.error("Health command error:", error);

  try {
    const errorResponse = {
      content:
        "❌ **Health Check Failed**\nAn error occurred while checking bot health. Please try again later.",
      flags: MessageFlags.Ephemeral,
    };

    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  } catch (replyError) {
    logger.error("Failed to send health error response:", replyError);
  }
}
