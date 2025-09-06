import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { createStorageEmbed } from "./embeds.js";

// ============================================================================
// STORAGE COMMAND HANDLERS
// ============================================================================

export async function handleStorageCheck(interaction, client, deferred = true) {
  const logger = getLogger();

  try {
    // Check developer permissions
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for storage command", {
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

    // Create storage status embed
    const embed = await createStorageEmbed(client, interaction.user);

    // Send response
    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Storage check completed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });
  } catch (error) {
    logger.error("Error in storage check:", error);
    await handleStorageError(interaction, error, deferred);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

async function handleStorageError(interaction, error, deferred) {
  const logger = getLogger();
  logger.error("Storage command error:", error);

  try {
    const errorResponse = {
      content:
        "❌ **Storage Check Failed**\nAn error occurred while checking storage status. Please try again later.",
      flags: 64,
    };

    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  } catch (replyError) {
    logger.error("Failed to send storage error response:", replyError);
  }
}
