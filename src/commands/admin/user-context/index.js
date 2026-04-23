import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

export const metadata = {
  name: "Quick Timeout",
  category: "admin",
  description: "Timeout a user for 10 minutes",
  keywords: ["timeout", "mute", "user", "mod"],
  emoji: "⏱️",
};

export const data = {
  type: ApplicationCommandType.User,
  name: metadata.name,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
};

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        content: "❌ You need admin permissions to timeout users.",
        ephemeral: true,
      });
    }

    const targetUser = interaction.targetUser;
    const targetMember = interaction.targetMember;

    if (!targetMember) {
      return interaction.reply({
        content: "❌ This user is not in the server.",
        ephemeral: true,
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        content:
          "❌ I cannot timeout this user. They may have higher permissions than me.",
        ephemeral: true,
      });
    }

    const duration = 10 * 60 * 1000;
    await targetMember.timeout(duration, "Quick timeout via context menu");

    const embed = new EmbedBuilder()
      .setTitle("⏱️ User Timed Out")
      .setColor(THEME.WARNING)
      .addFields(
        {
          name: "User",
          value: `${targetUser.username}#${targetUser.discriminator}`,
          inline: true,
        },
        {
          name: "Duration",
          value: "10 minutes",
          inline: true,
        },
        {
          name: "Reason",
          value: "Quick timeout",
          inline: true,
        },
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error in quick timeout context command:", error);
    return interaction.reply({
      content: "An error occurred while timing out the user.",
      ephemeral: true,
    });
  }
}
