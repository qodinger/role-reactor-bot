import { ApplicationCommandType, EmbedBuilder } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

export const metadata = {
  name: "Delete Message",
  category: "admin",
  description: "Delete a message",
  keywords: ["delete", "message", "remove", "mod"],
  emoji: "🗑️",
};

export const data = {
  type: ApplicationCommandType.Message,
  name: metadata.name,
};

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
