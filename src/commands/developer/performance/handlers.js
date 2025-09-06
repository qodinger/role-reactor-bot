import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { createPerformanceEmbed } from "./embeds.js";

// ============================================================================
// PERFORMANCE COMMAND HANDLERS
// ============================================================================

export async function handlePerformanceCheck(
  interaction,
  client,
  deferred = true,
) {
  const logger = getLogger();

  try {
    // Check developer permissions
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for performance command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      const response = {
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
        flags: 64,
      };

      if (deferred) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
      return;
    }

    // Create performance metrics embed
    const embed = await createPerformanceEmbed(client);

    // Send response
    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Performance check completed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });
  } catch (error) {
    logger.error("Error in performance check:", error);
    await handlePerformanceError(interaction, error, deferred);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

async function handlePerformanceError(interaction, error, deferred) {
  const logger = getLogger();
  logger.error("Performance command error:", error);

  try {
    const errorResponse = {
      content:
        "❌ **Performance Check Failed**\nAn error occurred while checking performance metrics. Please try again later.",
      flags: 64,
    };

    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  } catch (replyError) {
    logger.error("Failed to send performance error response:", replyError);
  }
}
