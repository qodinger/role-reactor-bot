import { ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "Delete Message",
  category: "admin",
  description: "Delete a message (right-click on message)",
  keywords: ["delete", "message", "remove", "mod", "context menu"],
  emoji: "🗑️",
  helpFields: [
    {
      name: `How to Use`,
      value: "Right-click on a message → Apps → Delete Message",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Messages** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Quickly delete any message by right-clicking on it. The message author and channel will be shown in the confirmation.",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new ContextMenuCommandBuilder()
  .setName(metadata.name)
  .setType(ApplicationCommandType.Message);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        content: "❌ You need admin permissions to delete messages.",
        ephemeral: true,
      });
    }

    const targetMessage = interaction.targetMessage;

    if (!targetMessage.deletable) {
      return interaction.reply({
        content: "❌ I cannot delete this message.",
        ephemeral: true,
      });
    }

    const channel = targetMessage.channel;
    const author = targetMessage.author;

    await targetMessage.delete();

    const { EmbedBuilder } = await import("discord.js");
    const embed = new EmbedBuilder()
      .setTitle("🗑️ Message Deleted")
      .setColor(THEME.SUCCESS)
      .addFields(
        {
          name: "Deleted Message",
          value:
            targetMessage.content.length > 0
              ? targetMessage.content.slice(0, 1000)
              : "(No text content)",
          inline: false,
        },
        {
          name: "Author",
          value: `${author.username}#${author.discriminator}`,
          inline: true,
        },
        {
          name: "Channel",
          value: channel.name,
          inline: true,
        },
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error in delete message context command:", error);
    return interaction.reply({
      content: "An error occurred while deleting the message.",
      ephemeral: true,
    });
  }
}
